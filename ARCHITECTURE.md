# Arquitetura

## 1. Visão geral

Este projeto é um backend para processamento de transações financeiras em um ambiente de jogos.

A arquitetura foi pensada principalmente para garantir:

- consistência financeira;
- precisão nos valores monetários;
- idempotência;
- controle de concorrência;
- histórico financeiro;
- processamento assíncrono;
- recuperação de falhas;
- observabilidade.

O projeto utiliza:

- **NestJS**
- **PostgreSQL**
- **MikroORM**
- **Amazon SQS**
- **LocalStack** para desenvolvimento local
- **JWT** para autenticação
- **Decimal.js** para valores monetários

A estrutura principal é:

```text
FinancialTransactionService
        │
        ├── Idempotência
        ├── Wallet
        ├── WagerTransaction
        ├── Ledger
        └── Outbox
                │
                ▼
        Outbox Publisher
                │
                ▼
               SQS
                │
                ▼
        SQS Consumer
                │
                ├── Inbox
                └── Handler
```

---

# 2. Organização do projeto

O projeto é dividido em três camadas principais:

```text
src/
├── domain/
├── application/
└── infrastructure/
```

## Domain

Contém as regras e entidades principais do sistema.

Exemplos:

- `Money`
- `Wallet`
- `WagerTransaction`
- `LedgerEntry`
- `InboxMessage`
- `OutboxMessage`

O domínio não depende de banco de dados, SQS ou NestJS.

---

## Application

Contém os casos de uso e a orquestração das operações.

Exemplos:

- `FinancialTransactionService`
- `IdempotencyService`
- `InboxService`
- `OutboxService`
- `WalletConcurrencyService`
- workers

É nessa camada que os componentes do domínio são combinados para executar as operações do sistema.

---

## Infrastructure

Contém as implementações relacionadas ao ambiente externo.

Exemplos:

- PostgreSQL;
- MikroORM;
- repositórios;
- SQS;
- workers;
- JWT;
- logs;
- correlation ID.

---

# 3. Fluxo de uma transação financeira

O principal fluxo do sistema acontece no `FinancialTransactionService`.

A operação é executada dentro de uma transação do banco.

## 3.1 Verificação de idempotência

Primeiro verificamos a `idempotencyKey`.

Existem três possibilidades:

### NEW

A chave ainda não existe.

A transação pode continuar.

### REPLAY

A mesma chave já foi utilizada com o mesmo payload.

Nesse caso, retornamos a transação existente e não fazemos um novo débito.

### CONFLICT

A chave já existe, mas o payload é diferente.

Nesse caso, a requisição é rejeitada.

Isso evita que uma mesma chave represente duas operações diferentes.

---

## 3.2 Busca da carteira

Depois buscamos a `Wallet`.

Se ela não existir, a operação falha.

---

## 3.3 Criação do Money

O valor recebido na requisição é convertido para o objeto `Money`.

Por exemplo:

```text
amount = "10.50"
currency = "BRL"
```

vira:

```text
Money(10.50 BRL)
```

O `Money` utiliza `Decimal.js`, evitando problemas de precisão com `number`.

---

## 3.4 Débito da carteira

Antes do débito guardamos o saldo atual:

```text
balanceBefore
```

Depois:

```text
wallet.debit(amount)
```

E guardamos o novo saldo:

```text
balanceAfter
```

Assim conseguimos registrar exatamente quanto foi alterado.

---

## 3.5 Criação da WagerTransaction

Criamos uma `WagerTransaction` com os dados da operação.

Ela guarda informações como:

- provider;
- external transaction ID;
- idempotency key;
- payload hash;
- wallet;
- player;
- round;
- game;
- amount;
- currency;
- kind;
- status.

---

## 3.6 Criação do Ledger

Criamos uma `LedgerEntry` para registrar a movimentação financeira.

Ela guarda:

```text
balanceBefore
amount
balanceAfter
```

Por exemplo:

```text
Saldo antes: 100
Débito:       30
Saldo depois: 70
```

O ledger funciona como o histórico financeiro da carteira.

---

## 3.7 Salvamento da Wallet

A carteira utiliza **optimistic locking** através do campo `version`.

O update é feito conceitualmente assim:

```sql
UPDATE wallets
SET balance = new_balance,
    version = version + 1
WHERE id = wallet_id
  AND version = current_version;
```

Se outra transação tiver alterado a carteira antes, a versão não será mais a esperada.

Nesse caso, o update não afeta nenhuma linha e o sistema identifica uma condição de concorrência.

---

## 3.8 Salvamento da transação e do ledger

Depois salvamos:

```text
WagerTransaction
LedgerEntry
```

Essas operações fazem parte da mesma transação do banco.

---

## 3.9 Criação do Outbox

Por último criamos uma `OutboxMessage`.

Ela representa um evento que deverá ser enviado para o SQS.

Exemplo:

```json
{
  "transactionId": "...",
  "walletId": "...",
  "playerId": "...",
  "amount": "10.00",
  "currency": "BRL"
}
```

O importante é que o Outbox também é salvo dentro da mesma transação do banco.

---

## 3.10 Commit

Se tudo funcionar:

```text
Wallet
WagerTransaction
LedgerEntry
OutboxMessage
```

são confirmados juntos.

Se alguma etapa falhar, a transação é revertida.

Assim evitamos situações como:

```text
Wallet atualizada
Ledger não criado
```

ou:

```text
Transação criada
Outbox não criado
```

---

# 4. Money

Valores financeiros são representados pelo `Money`.

Ele combina:

```text
amount
currency
```

e utiliza `Decimal.js` para realizar operações matemáticas.

Isso evita problemas comuns de precisão com `number` em JavaScript.

Além disso, o `Money` é imutável.

Em vez de alterar o valor original, as operações retornam um novo `Money`.

Também não permitimos operações inválidas entre moedas diferentes.

Por exemplo:

```text
10 BRL + 5 BRL
```

é válido.

Enquanto:

```text
10 BRL + 5 USD
```

não deve ser permitido.

---

# 5. Wallet e concorrência

A `Wallet` possui um campo `version`.

Por exemplo:

```text
balance = 100
version = 5
```

Duas requisições podem ler esses mesmos valores ao mesmo tempo.

```text
Transação A → version 5
Transação B → version 5
```

A primeira consegue atualizar:

```text
version 5 → 6
```

Quando a segunda tenta atualizar usando:

```text
WHERE version = 5
```

o banco não encontra mais essa versão.

Isso gera um conflito de concorrência.

Dessa forma, uma transação não sobrescreve silenciosamente o resultado da outra.

---

# 6. Idempotência

Idempotência evita que a mesma operação financeira seja executada mais de uma vez.

Exemplo:

```text
idempotencyKey = abc-123
```

A primeira requisição é processada.

Se a mesma requisição chegar novamente, o sistema identifica que ela já foi processada e retorna o resultado existente.

O saldo não é alterado novamente.

---

## Payload Hash

Também armazenamos um hash do payload.

Isso permite diferenciar:

```text
mesma key + mesmo payload
```

de:

```text
mesma key + payload diferente
```

O primeiro caso é um replay.

O segundo é um conflito.

---

# 7. Ledger

O `LedgerEntry` representa uma movimentação financeira.

Ele registra:

```text
transactionId
walletId
direction
amount
currency
balanceBefore
balanceAfter
```

O ledger é tratado como histórico e não deve ser alterado depois de criado.

Por exemplo:

```text
100 → 70
DEBIT 30
```

Depois:

```text
70 → 90
CREDIT 20
```

O histórico continua preservado.

Isso permite analisar as movimentações independentemente do saldo atual da carteira.

---

# 8. Outbox

O Outbox resolve um problema comum entre banco de dados e mensageria.

Sem Outbox, poderíamos ter:

```text
1. Salvar transação no banco
2. Enviar mensagem para SQS
```

Se o banco funcionar e o SQS falhar, ficamos com uma transação salva mas sem o evento.

Com o Outbox:

```text
Transação do banco
       │
       ├── Wallet
       ├── WagerTransaction
       ├── Ledger
       └── Outbox
```

Tudo é salvo junto.

Depois, outro processo publica o Outbox no SQS.

Se o SQS estiver indisponível, a mensagem continua salva no banco e poderá ser enviada novamente.

---

# 9. Outbox Publisher

O `OutboxPublisherWorker` procura mensagens pendentes.

Para cada mensagem:

1. publica no SQS;
2. marca como publicada se funcionar;
3. registra uma tentativa se falhar;
4. agenda uma nova tentativa.

Fluxo:

```text
Outbox
   ↓
Publisher Worker
   ↓
  SQS
```

---

# 10. SQS Consumer

O `SqsConsumerWorker` recebe mensagens do SQS.

O fluxo é:

```text
SQS
 ↓
Consumer
 ↓
Inbox
 ↓
Handler
 ↓
Delete da mensagem
```

Antes de processar a mensagem, calculamos seu hash e verificamos o Inbox.

Se ela ainda não foi processada, o handler é executado.

Depois do processamento, a mensagem é marcada como processada e removida do SQS.

---

# 11. Inbox

O Inbox existe porque mensagens podem ser entregues mais de uma vez.

Uma mensagem possui:

```text
messageId
consumerName
```

O sistema usa essas informações para identificar se aquele consumidor já processou a mensagem.

Exemplo:

```text
Mensagem 123
     ↓
wallet-consumer
     ↓
já processada?
```

Se já tiver sido processada, não executamos o handler novamente.

Isso torna o processamento do consumidor idempotente.

---

# 12. Falhas e recuperação

O sistema considera que falhas podem acontecer.

Alguns exemplos:

- erro no banco;
- erro no SQS;
- worker sendo interrompido;
- mensagem duplicada;
- concorrência;
- indisponibilidade temporária de serviços.

Cada mecanismo resolve um tipo de problema.

```text
Requisição duplicada
        ↓
   Idempotência

Mensagem duplicada
        ↓
       Inbox

Concorrência
        ↓
Optimistic Locking

Falha no envio
        ↓
      Outbox
```

---

## Falha no Outbox

Se o envio para o SQS falhar:

```text
Outbox
  ↓
Falha no envio
  ↓
Nova tentativa
```

A mensagem não é simplesmente perdida.

---

## Falha no Consumer

Se o handler falhar, a mensagem não é marcada como processada.

Assim ela pode ser entregue novamente pelo SQS.

---

## Falha de concorrência

Se a versão da carteira mudar antes do update, ocorre um conflito.

O sistema pode então tentar novamente utilizando a versão mais atual.

---

# 13. Autenticação

O projeto possui uma autenticação simples utilizando JWT.

O fluxo é:

```text
POST /auth/token
       ↓
      JWT
       ↓
Authorization: Bearer <token>
       ↓
JwtAuthGuard
       ↓
Endpoint protegido
```

O token contém o identificador do usuário no campo `sub`.

O `JwtAuthGuard` valida o token antes de liberar uma rota protegida.

Tokens inválidos ou expirados resultam em `401 Unauthorized`.

---

# 14. Observabilidade

O projeto possui logs estruturados e `Correlation ID`.

O `CorrelationIdMiddleware` verifica se a requisição possui:

```text
X-Correlation-ID
```

Se não possuir, um novo UUID é gerado.

Esse ID é armazenado através do `AsyncLocalStorage`.

O `LoggerService` pode então incluir o mesmo ID nos logs.

Exemplo:

```json
{
  "event": "transaction.created",
  "correlationId": "abc-123",
  "transactionId": "..."
}
```

Alguns eventos utilizados:

```text
transaction.created
transaction.processed
transaction.failed
outbox.published
outbox.publish_failed
sqs.message_received
sqs.message_processed
sqs.message_failed
```

Isso facilita acompanhar uma operação através dos diferentes componentes do sistema.

---

# 15. Garantias de consistência

Cada mecanismo resolve um problema específico:

| Problema | Solução |
|---|---|
| Precisão financeira | `Money` + `Decimal.js` |
| Requisições duplicadas | Idempotência |
| Mesma key com payload diferente | Payload Hash |
| Concorrência na Wallet | Optimistic Locking |
| Histórico financeiro | Ledger |
| Banco + mensageria | Outbox |
| Mensagens duplicadas | Inbox |
| Falha no envio | Retry do Outbox |
| Rastreamento | Correlation ID |
| Acesso protegido | JWT |

A ideia principal é que nenhum desses mecanismos trabalha sozinho.

Eles se complementam.

---

# 16. Trade-offs

Essa arquitetura é mais complexa que uma API CRUD tradicional.

Em uma aplicação simples poderíamos ter:

```text
Controller
   ↓
Service
   ↓
Database
```

Aqui temos mais componentes:

```text
Domain
Application
Infrastructure
Database Transactions
Idempotency
Ledger
Outbox
SQS
Inbox
Workers
Concurrency Control
Authentication
Observability
```

Essa complexidade existe porque uma operação financeira precisa ser mais cuidadosa com consistência e recuperação de falhas.

---

## Optimistic Locking

Foi escolhido em vez de manter locks longos no banco.

Vantagem:

- simples;
- não mantém locks por muito tempo;
- detecta conflitos explicitamente.

Desvantagem:

- transações que entram em conflito precisam ser tratadas ou repetidas.

---

## Outbox

Adiciona uma tabela e um worker, mas evita perder eventos quando o banco funciona e o SQS falha.

---

## Inbox

Adiciona persistência para controlar mensagens já processadas, mas permite tratar entregas duplicadas de forma segura.

---

# 17. Resumo da arquitetura

O fluxo principal pode ser resumido assim:

```text
                    ┌──────────────┐
                    │    Cliente   │
                    └──────┬───────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ FinancialTransaction│
                │      Service        │
                └──────────┬──────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        Idempotência     Wallet     WagerTransaction
                           │
                    Optimistic Lock
                           │
                           ▼
                      Ledger
                           │
                           ▼
                        Outbox
                           │
                     Commit no DB
                           │
                           ▼
                 Outbox Publisher
                           │
                           ▼
                          SQS
                           │
                           ▼
                  SQS Consumer
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                  Inbox         Handler
```

A ideia central da arquitetura é:

> A operação financeira deve permanecer correta mesmo quando existem requisições duplicadas, concorrência entre transações, mensagens duplicadas ou falhas temporárias nos serviços externos.