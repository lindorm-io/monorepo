import { Database } from "better-sqlite3";
import { randomUUID } from "crypto";
import { IKafkaDelayEnvelope, IKafkaDelayStore } from "../../interfaces";
import { KafkaDelayOptions } from "../../types";

export class DelaySqlite implements IKafkaDelayStore {
  private readonly db: Database;

  public constructor(database: Database) {
    this.db = database;
    this.init();
  }

  // public

  public async add(envelope: KafkaDelayOptions): Promise<void> {
    this.db
      .prepare(
        `
      INSERT INTO kafka_delay_messages (id, key, topic, value, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(
        randomUUID(),
        envelope.key,
        envelope.topic,
        envelope.value,
        Date.now() + envelope.delay,
      );
  }

  public async get(topic: string): Promise<Array<IKafkaDelayEnvelope>> {
    return this.db
      .prepare<
        [string, number],
        IKafkaDelayEnvelope
      >("SELECT * FROM kafka_delay_messages WHERE topic = ? AND timestamp <= ?")
      .all(topic, Date.now());
  }

  public async ack(id: string): Promise<void> {
    this.db.prepare("DELETE FROM kafka_delay_messages WHERE id = ?").run(id);
  }

  // private

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kafka_delay_messages (
        id TEXT PRIMARY KEY,
        key TEXT,
        topic TEXT NOT NULL,
        value BLOB NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }
}
