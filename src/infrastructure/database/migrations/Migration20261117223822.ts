import { Migration } from '@mikro-orm/migrations';

export class Migration20261117223822 extends Migration {
  override name = 'Migration20261117223822';

  override up(): void | Promise<void> {
    this.addSql(`
      create table "wallet_ledger_entries" (
        "id" uuid not null,
        "wallet_id" uuid not null,
        "transaction_id" uuid not null,
        "direction" text not null,
        "amount" numeric(20,2) not null,
        "currency" varchar(3) not null,
        "balance_before" numeric(20,2) not null,
        "balance_after" numeric(20,2) not null,
        "created_at" timestamptz not null,
        primary key ("id")
      );
    `);

    this.addSql(`
      create index "ledger_wallet_created_idx"
      on "wallet_ledger_entries" ("wallet_id", "created_at", "id");
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "ledger_transaction_wallet_unique"
      unique ("transaction_id", "wallet_id");
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_wallet_id_foreign"
      foreign key ("wallet_id")
      references "wallets" ("id");
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_transaction_id_foreign"
      foreign key ("transaction_id")
      references "wager_transactions" ("id");
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_direction_check"
      check ("direction" in ('DEBIT', 'CREDIT'));
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_amount_positive"
      check ("amount" > 0);
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_currency_format"
      check ("currency" ~ '^[A-Z]{3}$');
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_balance_before_non_negative"
      check ("balance_before" >= 0);
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_balance_after_non_negative"
      check ("balance_after" >= 0);
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
      add constraint "wallet_ledger_entries_balance_transition"
      check (
        (
          "direction" = 'DEBIT'
          and "balance_after" = "balance_before" - "amount"
        )
        or
        (
          "direction" = 'CREDIT'
          and "balance_after" = "balance_before" + "amount"
        )
      );
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(`
      drop table if exists "wallet_ledger_entries" cascade;
    `);
  }
}