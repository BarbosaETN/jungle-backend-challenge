# Architecture

## 1. Overview

O projeto é um backend para processamento de transações financeiras em um ambiente de jogos.

A arquitetura prioriza:

- consistência financeira;
- precisão monetária;
- idempotência;
- concorrência;
- histórico financeiro;
- processamento assíncrono;
- recuperação de conflitos;
- separação de responsabilidades.

Stack principal:

- NestJS;
- TypeScript;
- PostgreSQL;
- MikroORM;
- Decimal.js;
- Amazon SQS;
- LocalStack;
- Docker.

---

# 2. Organização

A aplicação é organizada em três áreas principais:

```text
src/
├── domain/
├── application/
└── infrastructure/
```

## 2.1 Domain

O domínio contém as regras centrais do sistema.

Principais objetos:

```text
Money
Wallet
WagerTransaction
LedgerEntry
InboxMessage
OutboxMessage
```

Os objetos de domínio possuem construtores controlados e métodos de criação/restauração, evitando que estados inválidos sejam criados diretamente.

---

## 2.2 Application

A camada de aplicação coordena os casos de uso.

Entre os principais componentes:

```text
FinancialTransactionService
IdempotencyService
WalletConcurrencyService
WalletConcurrencyRetryService
InboxService
OutboxService
Workers
```

O `FinancialTransactionService` concentra o fluxo principal de processamento financeiro.

---

## 2.3 Infrastructure

A infraestrutura implementa as integrações externas:

```text
PostgreSQL
MikroORM
Repositories
SQS
LocalStack
JWT
Logging
Correlation ID
```

O objetivo é manter essas preocupações separadas das regras de negócio.

---

# 3. Financial Transaction Flow

O processamento financeiro é realizado pelo `FinancialTransactionService`.

De forma simplificada:

```text
HTTP / Worker
      │
      ▼
FinancialTransactionService
      │
      ├── Idempotency
      │
      ├── Wallet
      │
      ├── Money
      │
      ├── WagerTransaction
      │
      ├── Ledger
      │
      └── Outbox
              │
              ▼
             SQS
```

A operação financeira é executada dentro de uma transação do PostgreSQL.

---

## 3.1 Idempotency

Antes de aplicar o efeito financeiro, a aplicação verifica a chave de idempotência.

O serviço possui três resultados possíveis:

### NEW

A chave ainda não existe.

A operação pode continuar.

### REPLAY

A chave já existe e o hash do payload corresponde ao payload recebido.

A transação existente é retornada sem executar novamente o efeito financeiro.

### CONFLICT

A chave já existe, mas o payload é diferente.

A operação é tratada como conflito de idempotência.

A garantia final da criação da chave é realizada pelo banco de dados.

Isso é importante porque duas requisições podem verificar a ausência da mesma chave simultaneamente.

Nesse cenário, a restrição de unicidade do banco impede a criação duplicada e o serviço recupera a operação já persistida.

---

# 4. Money Value Object

Valores financeiros são representados pelo `Money`.

Exemplo:

```ts
Money.from("100.00", "BRL");
```

O `Money` utiliza `Decimal.js` para realizar operações aritméticas.

A aplicação evita `number`, `float` e `double` para representar valores monetários.

O objeto também valida:

- representação decimal;
- moeda;
- valores inválidos;
- operações entre moedas diferentes.

Exemplo válido:

```text
10.00 BRL + 5.00 BRL
```

Exemplo inválido:

```text
10.00 BRL + 5.00 USD
```

---

# 5. Wallet

A `Wallet` representa o saldo materializado de um jogador para determinada moeda.

Ela possui, entre outros dados:

```text
walletId
playerId
currency
balance
version
```

O banco possui restrições para preservar invariantes importantes, incluindo unicidade da carteira por jogador/moeda e impossibilidade de saldo negativo.

---

# 6. Concurrency Control

A aplicação utiliza optimistic locking através do campo `version`.

Um update conceitualmente segue:

```sql
UPDATE wallets
SET
    balance = :newBalance,
    version = version + 1
WHERE id = :walletId
  AND version = :expectedVersion;
```

Se outra transação alterar a carteira primeiro, a versão esperada deixa de ser válida.

Nesse caso ocorre um conflito de concorrência.

O projeto possui um serviço de retry específico para esses conflitos:

```text
FinancialTransactionService
        │
        ▼
WalletConcurrencyRetryService
        │
        ├── tentativa
        │
        ├── conflito?
        │
        └── retry
```

Isso evita o padrão perigoso de:

```text
read balance
calculate balance
write balance
```

sem nenhuma proteção contra alterações concorrentes.

---

# 7. WagerTransaction

A `WagerTransaction` representa a operação financeira recebida.

Ela mantém informações como:

```text
providerId
externalTransactionId
idempotencyKey
payloadHash
walletId
playerId
roundId
gameId
amount
kind
status
```

Os estados e tipos de transação são representados por tipos explícitos no domínio.

A criação e restauração da entidade são realizadas através de métodos controlados:

```ts
WagerTransaction.create(...)
WagerTransaction.restore(...)
```

---

# 8. Ledger

O `LedgerEntry` representa o histórico da alteração financeira.

Um registro contém informações como:

```text
transactionId
walletId
direction
amount
currency
balanceBefore
balanceAfter
```

Exemplo:

```text
balanceBefore: 100.00
direction:     DEBIT
amount:        30.00
balanceAfter:  70.00
```

O saldo materializado da carteira e o histórico financeiro são mantidos como conceitos distintos.

O ledger é tratado como histórico da movimentação e não como um registro que deve ser sobrescrito para representar o saldo atual.

---

# 9. Database Transaction

A operação financeira agrupa as alterações relacionadas dentro da mesma transação do PostgreSQL.

Conceitualmente:

```text
BEGIN
  │
  ├── idempotency check
  ├── wallet update
  ├── wager transaction
  ├── ledger entry
  └── outbox message
  │
COMMIT
```

Caso uma etapa falhe, a transação é revertida.

Isso evita estados intermediários como:

```text
Wallet atualizada
Ledger não persistido
```

ou:

```text
WagerTransaction persistida
Outbox não persistido
```

---

# 10. Transactional Outbox

O projeto utiliza o padrão Transactional Outbox.

A ideia é persistir o evento junto com a operação financeira:

```text
PostgreSQL Transaction
        │
        ├── Wallet
        ├── WagerTransaction
        ├── LedgerEntry
        └── OutboxMessage
```

Somente após o commit a mensagem pode ser publicada para o sistema de mensageria.

O publisher é responsável por buscar mensagens pendentes e realizar a publicação.

Essa abordagem reduz o risco de inconsistência entre o banco de dados e o broker.

---

# 11. Messaging

A infraestrutura de mensageria utiliza Amazon SQS, com LocalStack no ambiente local.

O projeto possui componentes separados para:

```text
Publisher
Consumer
Workers
SQS Client
```

A comunicação utiliza mensagens estruturadas contendo informações da operação.

O processamento assíncrono é mantido separado do processamento HTTP.

---

# 12. Inbox

O domínio possui o conceito de `InboxMessage` e um serviço específico para controle de mensagens recebidas.

O objetivo é permitir que uma mensagem identificada pelo consumidor seja reconhecida e não gere efeitos duplicados quando houver redelivery.

A Inbox faz parte da estratégia de processamento idempotente de mensagens.

---

# 13. Observability

A aplicação utiliza logging estruturado e `correlationId`.

O correlation ID permite acompanhar uma operação através das diferentes camadas da aplicação.

Contextos relevantes incluem:

```text
correlationId
transactionId
walletId
playerId
messageId
```

O projeto evita registrar payloads financeiros completos desnecessariamente.

---

# 14. Authentication

Foi implementada uma camada de autenticação JWT.

A autenticação é tratada como uma preocupação complementar ao fluxo financeiro principal.

Em uma implantação de produção, essa camada pode ser substituída ou integrada a um provedor externo de identidade.

---

# 15. Testing Strategy

A estratégia de testes possui três níveis principais.

## Unit Tests

Testam regras isoladas do domínio e aplicação.

Exemplos:

- `Money`;
- `Wallet`;
- `WagerTransaction`;
- `Ledger`;
- idempotência;
- concorrência.

## Integration Tests

Utilizam PostgreSQL real para validar a interação entre aplicação e banco.

Exemplos:

- persistência;
- constraints;
- transações;
- idempotência;
- concorrência;
- múltiplas instâncias dos componentes de aplicação.

## Concurrency Tests

Existem cenários de concorrência real utilizando operações paralelas contra PostgreSQL.

Exemplo:

```text
Initial balance = 100

BET 80
BET 80
```

O sistema deve garantir:

```text
1 operação aplicada
1 operação rejeitada
final balance = 20
```

Outro cenário utiliza múltiplas requisições simultâneas com a mesma chave de idempotência.

O resultado esperado é uma única operação financeira efetiva, enquanto as demais requisições recebem o resultado da operação já existente.

---

# 16. Main Architectural Guarantees

As principais garantias buscadas pela arquitetura são:

### Precisão

Valores financeiros não dependem de `number`/floating point.

### Idempotência

A mesma operação não deve produzir múltiplos efeitos financeiros.

### Concorrência

A atualização da carteira possui controle de versão e retry.

### Atomicidade

As alterações financeiras relacionadas são persistidas na mesma transação do banco.

### Auditoria

Movimentações financeiras possuem registros de ledger.

### Assíncrono

A publicação de eventos é desacoplada através do Outbox e da infraestrutura de mensageria.

### Multi-instance

As garantias de consistência não dependem de memória local ou de um único processo da aplicação.

---

# 17. Trade-offs

Algumas decisões foram tomadas priorizando simplicidade e segurança do domínio financeiro.

### Optimistic Locking

Foi escolhido para evitar locks globais e permitir concorrência entre carteiras diferentes.

### Idempotência no banco

A chave de idempotência é persistida e protegida por constraint, evitando depender de memória local.

### Transactional Outbox

Adiciona uma etapa de persistência, mas reduz o risco de inconsistência entre banco e mensageria.

### Decimal.js

Adiciona uma dependência específica para valores financeiros, mas evita os problemas de precisão associados a números de ponto flutuante.

---

# 18. Conclusion

A arquitetura foi construída em torno de uma premissa principal:

> O banco de dados é a autoridade final para consistência financeira.

Por isso, as principais garantias de idempotência, concorrência, atomicidade e integridade são sustentadas por transações e constraints do PostgreSQL, enquanto componentes como SQS, workers e Outbox são utilizados para processamento assíncrono e integração entre componentes.