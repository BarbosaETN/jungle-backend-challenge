import { Migration } from '@mikro-orm/migrations';

export class Migration20261117135000 extends Migration {
  override name = 'Migration20261117135000';

  override up(): void | Promise<void> {
    this.addSql(`
      alter table "wallets"
      add constraint "wallet_balance_non_negative"
      check ("balance" >= 0);
    `);

    this.addSql(`
      alter table "wallets"
      add constraint "wallet_version_positive"
      check ("version" >= 1);
    `);

    this.addSql(`
      alter table "wallets"
      add constraint "wallet_currency_format"
      check ("currency" ~ '^[A-Z]{3}$');
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(`
      alter table "wallets"
      drop constraint if exists "wallet_currency_format";
    `);

    this.addSql(`
      alter table "wallets"
      drop constraint if exists "wallet_version_positive";
    `);

    this.addSql(`
      alter table "wallets"
      drop constraint if exists "wallet_balance_non_negative";
    `);
  }
}