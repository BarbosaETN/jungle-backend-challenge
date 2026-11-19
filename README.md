# Jungle Backend Challenge

Backend desenvolvido para o desafio técnico da Jungle Gaming.

O projeto implementa um fluxo de processamento de transações financeiras com foco em consistência, idempotência, concorrência, histórico financeiro e processamento assíncrono.

## Tecnologias

- **Node.js**
- **TypeScript**
- **NestJS**
- **PostgreSQL**
- **MikroORM**
- **Amazon SQS**
- **LocalStack**
- **Decimal.js**
- **JWT**
- **Jest**
- **Supertest**
- **Docker Compose**
- **Bun**

---

# Arquitetura

O projeto é dividido em três camadas principais:

```text
src/
├── domain/
├── application/
└── infrastructure/
```

### Domain

Contém as regras e conceitos principais do sistema:

- `Money`
- `Wallet`
- `WagerTransaction`
- `LedgerEntry`
- `InboxMessage`
- `OutboxMessage`

### Application

Contém os casos de uso e a orquestração das operações:

- transações financeiras;
- idempotência;
- concorrência;
- Inbox;
- Outbox;
- workers.

### Infrastructure

Contém as implementações relacionadas a recursos externos:

- PostgreSQL;
- MikroORM;
- repositórios;
- SQS;
- JWT;
- observabilidade;
- workers.

Para uma explicação mais detalhada da arquitetura, consulte [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

# Principais decisões técnicas

## Money e precisão financeira

Valores monetários são representados pelo `Money`, utilizando `Decimal.js`.

Isso evita problemas de precisão causados pelo uso de `number` em operações financeiras.

O `Money` também mantém o valor e a moeda juntos e é tratado como um objeto imutável.

---

## Idempotência

As transações utilizam uma `idempotencyKey`.

O sistema também armazena um hash do payload.

Isso permite diferenciar:

- uma repetição legítima da mesma requisição;
- uma requisição conflitante utilizando a mesma chave com dados diferentes.

---

## Controle de concorrência

As carteiras utilizam **optimistic locking** através de um campo `version`.

Uma atualização só é realizada se a versão lida anteriormente ainda for a versão atual no banco.

Isso evita que duas operações concorrentes sobrescrevam silenciosamente o saldo uma da outra.

---

## Ledger

Cada movimentação financeira gera uma entrada no ledger.

A entrada registra:

- transação;
- carteira;
- direção;
- valor;
- moeda;
- saldo anterior;
- saldo posterior.

O ledger funciona como histórico das movimentações financeiras.

---

## Transactional Outbox

A alteração financeira e o registro do evento no Outbox são realizados dentro da mesma transação do banco.

Depois, o `OutboxPublisherWorker` publica os eventos pendentes no SQS.

Isso evita perder eventos caso o banco seja atualizado mas o SQS esteja temporariamente indisponível.

---

## Inbox

O consumidor utiliza o padrão Inbox para evitar o processamento duplicado de mensagens.

Antes de processar uma mensagem, o sistema verifica se ela já foi processada pelo consumidor.

---

## SQS e Workers

O processamento assíncrono utiliza Amazon SQS.

Durante o desenvolvimento local, o SQS é executado através do LocalStack.

Existem dois principais workers:

```text
OutboxPublisherWorker
        ↓
       SQS
        ↓
SqsConsumerWorker
        ↓
      Inbox
        ↓
     Handler
```

---

## Observabilidade

O projeto utiliza:

- logs estruturados;
- eventos de log;
- correlation ID;
- `AsyncLocalStorage`.

O correlation ID permite relacionar logs pertencentes à mesma operação.

---

## Autenticação

A autenticação utiliza JWT.

O projeto possui:

```text
POST /auth/token
```

para geração de tokens e um guard responsável pela proteção de endpoints autenticados.

---

# Requisitos

Para executar o projeto localmente, é necessário ter instalado:

- Node.js
- Bun
- Docker
- Docker Compose

O projeto foi desenvolvido utilizando Node.js 24 e Bun.

---

# Configuração do ambiente

Crie um arquivo `.env` na raiz do projeto.

Exemplo:

```env
NODE_ENV=development

PORT=3000

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=jungle
DATABASE_USER=jungle
DATABASE_PASSWORD=jungle
```

As configurações de AWS/SQS utilizadas pelo ambiente local também devem estar presentes no `.env`, conforme o `docker-compose.yml` e a configuração de mensageria do projeto.

---

# Instalação

Instale as dependências:

```bash
bun install
```

---

# Infraestrutura local

O projeto utiliza Docker para executar os serviços necessários para desenvolvimento.

Suba os containers:

```bash
docker compose up -d
```

Os principais serviços utilizados são:

- PostgreSQL
- LocalStack

Para verificar os containers:

```bash
docker compose ps
```

---

# Banco de dados

O projeto utiliza PostgreSQL com MikroORM.

As migrations estão localizadas em:

```text
src/infrastructure/database/migrations/
```

Para executar as migrations através do MikroORM CLI:

```bash
bunx mikro-orm migration:up
```

Para verificar o estado das migrations:

```bash
bunx mikro-orm migration:list
```

---

# Executando a aplicação

Para iniciar em modo desenvolvimento:

```bash
bun run start:dev
```

A aplicação será executada na porta configurada pela variável:

```env
PORT=3000
```

Para executar a versão compilada:

```bash
bun run build
bun run start:prod
```

---

# Testes

O projeto possui testes unitários, de integração, concorrência e E2E.

## Todos os testes

```bash
bun run test
```

## Testes em modo watch

```bash
bun run test:watch
```

## Coverage

```bash
bun run test:cov
```

## Testes E2E

```bash
bun run test:e2e
```

---

# Tipos de testes

A suíte de testes cobre diferentes partes do sistema.

### Testes unitários

Validam componentes isoladamente, como:

- `Money`;
- `Wallet`;
- `LedgerEntry`;
- `WagerTransaction`;
- idempotência;
- serviços;
- guards;
- mappers.

### Testes de integração

Validam a interação entre componentes reais, incluindo:

- PostgreSQL;
- MikroORM;
- transações;
- Inbox;
- Outbox;
- SQS.

### Testes de concorrência

Validam situações onde múltiplas operações tentam alterar a mesma carteira simultaneamente.

O objetivo é garantir que o optimistic locking impeça lost updates.

### Testes E2E

Validam o comportamento dos endpoints da aplicação, incluindo o fluxo de autenticação.

---

# Fluxo de uma transação financeira

O fluxo principal pode ser resumido assim:

```text
Request
   │
   ▼
Idempotência
   │
   ▼
Wallet
   │
   ├── Debit
   │
   ▼
WagerTransaction
   │
   ▼
LedgerEntry
   │
   ▼
OutboxMessage
   │
   ▼
Database Commit
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
   ▼
Inbox
   │
   ▼
Message Handler
```

As alterações financeiras e o registro do Outbox são realizados dentro da mesma transação do banco.

---

# Tratamento de falhas

O sistema utiliza diferentes mecanismos para lidar com falhas:

| Situação | Mecanismo |
|---|---|
| Requisição duplicada | Idempotência |
| Mesmo ID com payload diferente | Payload Hash |
| Concorrência na carteira | Optimistic Locking |
| Histórico financeiro | Ledger |
| Falha na publicação | Outbox + retry |
| Mensagem duplicada | Inbox |
| Rastreamento de operações | Correlation ID |

A ideia é que cada mecanismo resolva um problema específico de consistência ou recuperação.

---

# Estrutura do projeto

```text
src/
├── application/
│   ├── auth/
│   ├── concurrency/
│   ├── financial/
│   ├── idempotency/
│   ├── inbox/
│   ├── messaging/
│   ├── outbox/
│   └── workers/
│
├── domain/
│   ├── idempotency/
│   ├── inbox/
│   ├── ledger/
│   ├── money/
│   ├── outbox/
│   ├── wager-transaction/
│   └── wallet/
│
└── infrastructure/
    ├── database/
    ├── messaging/
    ├── observability/
    └── workers/
```

---

# Scripts disponíveis

| Comando | Descrição |
|---|---|
| `bun run build` | Compila o projeto |
| `bun run start` | Inicia a aplicação |
| `bun run start:dev` | Inicia em desenvolvimento |
| `bun run start:prod` | Executa a versão compilada |
| `bun run lint` | Executa o lint |
| `bun run test` | Executa os testes |
| `bun run test:watch` | Testes em modo watch |
| `bun run test:cov` | Testes com coverage |
| `bun run test:e2e` | Executa os testes E2E |

---

# Status

Projeto desenvolvido como parte do desafio técnico para a vaga de Backend Developer Júnior da Jungle Gaming.

Principais funcionalidades implementadas:

- [x] Money com precisão decimal
- [x] Wallet
- [x] WagerTransaction
- [x] Ledger
- [x] Idempotência
- [x] Inbox
- [x] Outbox
- [x] SQS
- [x] Workers
- [x] Controle de concorrência
- [x] Testes de integração
- [x] Testes de concorrência
- [x] Tratamento de falhas e recuperação
- [x] Autenticação JWT
- [x] Observabilidade
- [x] Correlation ID
- [x] Documentação da arquitetura

---

# Documentação

Para entender as decisões arquiteturais e o fluxo completo do sistema:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)