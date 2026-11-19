# Jungle Gaming Backend Challenge

Backend desenvolvido para o desafio técnico da Jungle Gaming.

O projeto implementa um fluxo de processamento de transações financeiras com foco em **consistência financeira, precisão monetária, idempotência, concorrência, histórico de transações e processamento assíncrono**.

## Tecnologias

- Node.js
- Bun
- TypeScript
- NestJS
- PostgreSQL
- MikroORM
- Decimal.js
- Amazon SQS
- LocalStack
- Docker / Docker Compose
- Jest
- Supertest

---

## Arquitetura

A aplicação utiliza uma separação entre domínio, aplicação e infraestrutura.

```text
src/
├── domain/
├── application/
└── infrastructure/
```

### Domain

Contém as regras de negócio e os objetos centrais do sistema:

- `Money`
- `Wallet`
- `WagerTransaction`
- `LedgerEntry`
- `InboxMessage`
- `OutboxMessage`

O domínio não depende diretamente de NestJS, PostgreSQL ou SQS.

### Application

Contém os casos de uso e serviços responsáveis pela orquestração das operações:

- processamento financeiro;
- idempotência;
- controle de concorrência;
- Inbox;
- Outbox;
- workers.

### Infrastructure

Contém as integrações externas:

- PostgreSQL;
- MikroORM;
- repositórios;
- SQS;
- LocalStack;
- autenticação;
- logging;
- correlation ID.

---

## Principais decisões técnicas

### Dinheiro

Valores monetários não utilizam `number`, `float` ou `double`.

O projeto utiliza `Decimal.js` através do Value Object `Money`.

Exemplo:

```ts
Money.from("100.00", "BRL");
```

O `Money` mantém o valor monetário como representação decimal e valida a moeda utilizada nas operações.

Isso evita problemas de precisão comuns em operações financeiras utilizando números de ponto flutuante.

---

### Wallet

Uma `Wallet` possui:

- `walletId`;
- `playerId`;
- `currency`;
- `balance`;
- `version`.

O saldo não pode assumir valores negativos.

A atualização da carteira utiliza controle de concorrência baseado em versão.

Conceitualmente:

```sql
UPDATE wallets
SET
    balance = ...,
    version = version + 1
WHERE id = ...
  AND version = ...;
```

Quando ocorre um conflito de versão, a operação pode ser reexecutada através do mecanismo de retry de concorrência.

---

### Ledger

Toda alteração financeira aplicada à carteira gera um registro correspondente no ledger.

O registro mantém informações como:

- carteira;
- transação;
- direção;
- valor;
- moeda;
- saldo anterior;
- saldo posterior.

O ledger funciona como histórico da movimentação financeira e não deve ser utilizado como um simples campo mutável de saldo.

---

## Idempotência

As operações financeiras utilizam `Idempotency-Key`.

A aplicação armazena a chave juntamente com um hash do payload da operação.

Existem três possibilidades:

### Nova operação

A chave ainda não existe e a operação pode ser processada.

### Replay

A chave já existe e o payload é equivalente.

Nesse caso, a operação existente é retornada sem executar novamente o efeito financeiro.

### Conflito

A chave já existe, mas o payload é diferente.

Nesse caso, a requisição é tratada como conflito de idempotência.

A proteção também considera a corrida entre múltiplas requisições tentando criar a mesma chave simultaneamente, utilizando as restrições do banco de dados como garantia final.

---

## Concorrência

O controle de concorrência é baseado no banco de dados e não em locks globais ou estado mantido em memória.

O projeto possui um mecanismo de optimistic locking através do campo `version` da carteira.

Além disso, conflitos de concorrência são tratados por um mecanismo de retry.

Isso permite que múltiplas instâncias da aplicação concorram pela mesma carteira sem depender da ordem de execução dos processos.

Um dos cenários testados é:

```text
Saldo inicial: 100

BET 80
BET 80
```

O resultado esperado é:

```text
Uma operação processada
Uma operação rejeitada por saldo insuficiente

Saldo final: 20
```

Também existem testes de concorrência envolvendo múltiplas operações simultâneas e múltiplas instâncias dos componentes de aplicação.

---

## Transações financeiras

O fluxo financeiro principal é centralizado no `FinancialTransactionService`.

De forma simplificada:

```text
Request
   │
   ▼
Idempotência
   │
   ▼
Wallet
   │
   ▼
Money
   │
   ▼
Regra financeira
   │
   ├── WagerTransaction
   ├── Wallet
   ├── Ledger
   └── Outbox
           │
           ▼
        Commit
```

As alterações relacionadas à operação financeira são executadas dentro da mesma transação do PostgreSQL.

Dessa forma, uma falha durante a operação provoca rollback da transação.

---

## Outbox

O projeto utiliza o padrão Transactional Outbox para desacoplar a persistência financeira da publicação de mensagens.

Em vez de depender de:

```text
Banco → SQS
```

diretamente durante a requisição, a aplicação persiste a mensagem de Outbox junto com a operação financeira.

Posteriormente, um publisher pode buscar as mensagens pendentes e publicá-las no sistema de mensageria.

Isso reduz o risco de uma operação financeira ser confirmada sem que o evento correspondente seja registrado para publicação.

---

## SQS

O projeto possui integração com Amazon SQS e utiliza LocalStack para desenvolvimento e testes locais.

A infraestrutura de mensageria possui:

- publisher;
- consumer;
- workers;
- fila de transações;
- fila de dead-letter.

O processamento assíncrono é separado do fluxo HTTP através dos workers.

A aplicação também possui componentes de Inbox para controle de mensagens já processadas.

---

## Observabilidade

O projeto possui logging estruturado e suporte a `correlationId`.

Informações de contexto podem ser associadas aos logs, como:

- `correlationId`;
- `transactionId`;
- `walletId`;
- `playerId`;
- `messageId`.

O objetivo é facilitar o rastreamento de uma operação ao longo dos diferentes componentes da aplicação.

---

## Autenticação

Foi implementada autenticação utilizando JWT como camada complementar da aplicação.

A autenticação não representa o foco principal do desafio, cujo objetivo está concentrado na consistência das operações financeiras, concorrência, idempotência e processamento assíncrono.

Em um ambiente de produção, a autenticação poderia ser integrada a um provedor externo de identidade.

---

# Testes

O projeto possui testes unitários, de integração e de concorrência.

Entre os cenários cobertos estão:

- validação do `Money`;
- operações monetárias;
- invariantes de `Wallet`;
- criação e restauração de `WagerTransaction`;
- ledger;
- idempotência;
- replay de requisições;
- conflito de idempotência;
- concorrência sobre uma mesma carteira;
- operações simultâneas em carteiras diferentes;
- múltiplas instâncias da aplicação;
- concorrência da mesma operação;
- persistência utilizando PostgreSQL.

Um dos principais cenários de concorrência é a disputa por saldo entre operações simultâneas.

Também existe cobertura para a proteção contra duplicação causada por concorrência na criação da chave de idempotência.

---

## Execução

### Instalar dependências

```bash
bun install
```

### Subir infraestrutura

```bash
docker compose up -d
```

### Executar migrations

```bash
bunx mikro-orm migration:up
```

### Executar aplicação

```bash
bun run start:dev
```

---

## Scripts

```bash
bun test
bun run build
bun run lint
```

---

## Variáveis de ambiente

As configurações de banco de dados, SQS e aplicação são definidas através de variáveis de ambiente.

Utilize o arquivo de exemplo do projeto como referência para configurar o ambiente local.

---

## Status

O projeto foi desenvolvido priorizando os requisitos de maior impacto para o domínio financeiro:

- precisão monetária;
- consistência transacional;
- idempotência persistente;
- concorrência;
- histórico financeiro;
- integração assíncrona;
- testes automatizados.

As decisões arquiteturais foram tomadas buscando manter a garantia final no banco de dados, evitando depender exclusivamente de comportamento do broker ou de estado em memória.