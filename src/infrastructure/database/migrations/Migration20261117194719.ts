import { Migration } from '@mikro-orm/migrations';

export class Migration20261117194719 extends Migration {
  override name = 'Migration20261117194719';

  override up(): void | Promise<void> {
    this.addSql(
      `create table "wager_transactions" ("id" uuid not null, "provider_id" varchar(100) not null, "external_transaction_id" varchar(255) not null, "idempotency_key" varchar(255) not null, "payload_hash" varchar(64) not null, "wallet_id" uuid not null, "player_id" varchar(255) not null, "round_id" varchar(255) not null, "game_id" varchar(255) not null, "amount" numeric(20,2) not null, "currency" varchar(3) not null, "kind" text not null, "reference_external_transaction_id" varchar(255) null, "reference_transaction_id" uuid null, "status" text not null, "failure_code" varchar(100) null, "processed_at" timestamptz null, "created_at" timestamptz not null, primary key ("id"));`,
    );
    this.addSql(
      `create index "wager_transaction_provider_reference_idx" on "wager_transactions" ("provider_id", "reference_external_transaction_id");`,
    );
    this.addSql(
      `create index "wager_transaction_status_idx" on "wager_transactions" ("status");`,
    );
    this.addSql(
      `create index "wager_transaction_player_idx" on "wager_transactions" ("player_id");`,
    );
    this.addSql(
      `create index "wager_transaction_wallet_idx" on "wager_transactions" ("wallet_id");`,
    );
    this.addSql(
      `alter table "wager_transactions" add constraint "wager_transaction_idempotency_unique" unique ("idempotency_key");`,
    );
    this.addSql(
      `alter table "wager_transactions" add constraint "wager_transaction_provider_external_unique" unique ("provider_id", "external_transaction_id");`,
    );

    this.addSql(
      `alter table "wager_transactions" add constraint "wager_transactions_wallet_id_foreign" foreign key ("wallet_id") references "wallets" ("id");`,
    );
    this.addSql(
      `alter table "wager_transactions" add constraint "wager_transactions_reference_transaction_id_foreign" foreign key ("reference_transaction_id") references "wager_transactions" ("id") on delete set null;`,
    );
    this.addSql(
      `alter table "wager_transactions" add constraint "wager_transactions_kind_check" check ("kind" in ('OPENING', 'BET', 'WIN', 'LOSS', 'REFUND', 'ROLLBACK'));`,
    );
    this.addSql(
      `alter table "wager_transactions" add constraint "wager_transactions_status_check" check ("status" in ('PENDING', 'PENDING_REFERENCE', 'PROCESSED', 'REJECTED', 'FAILED'));`,
    );

    this.addSql(`
      alter table "wager_transactions"
      add constraint "wager_transactions_amount_positive"
      check ("amount" > 0);
    `);

    this.addSql(`
      alter table "wager_transactions"
      add constraint "wager_transactions_currency_format"
      check ("currency" ~ '^[A-Z]{3}$');
    `);

    this.addSql(`
      alter table "wager_transactions"
      add constraint "wager_transactions_payload_hash_format"
      check (length("payload_hash") = 64);
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(
      `alter table "wager_transactions" drop constraint "wager_transactions_reference_transaction_id_foreign";`,
    );

    this.addSql(`drop table if exists "wager_transactions" cascade;`);
  }
}
