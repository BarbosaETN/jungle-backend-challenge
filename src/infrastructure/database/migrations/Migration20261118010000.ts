import { Migration } from '@mikro-orm/migrations';

export class Migration20261118010000 extends Migration {
  override name = 'Migration20261118010000';

  override up(): void | Promise<void> {
    this.addSql(`
      create table "inbox_messages" (
        "message_id" varchar(255) not null,
        "consumer_name" varchar(100) not null,
        "payload_hash" varchar(64) not null,
        "received_at" timestamptz not null,
        "processed_at" timestamptz null,
        primary key ("message_id", "consumer_name")
      );
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(`
      drop table if exists "inbox_messages";
    `);
  }
}
