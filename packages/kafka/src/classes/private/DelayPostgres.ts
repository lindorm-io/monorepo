import { IPostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { IKafkaDelayEnvelope, IKafkaDelayStore } from "../../interfaces";
import { KafkaDelayOptions } from "../../types";

export class DelayPostgres implements IKafkaDelayStore {
  private readonly pool: Pool;
  private promise: Promise<void>;

  public constructor(source: IPostgresSource) {
    this.pool = source.client;
    this.promise = this.init();
  }

  // public

  public async add(envelope: KafkaDelayOptions): Promise<void> {
    await this.promise;

    const timestamp = Date.now() + envelope.delay;

    await this.pool.query(
      `
        INSERT INTO kafka_delay_messages (id, key, topic, value, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        randomUUID(),
        envelope.key ?? null,
        envelope.topic,
        envelope.value.toString("base64"),
        timestamp,
      ],
    );
  }

  public async get(topic: string): Promise<IKafkaDelayEnvelope[]> {
    await this.promise;

    const now = Date.now();

    const { rows } = await this.pool.query(
      `
        SELECT id, key, topic, value, timestamp
        FROM kafka_delay_messages
        WHERE topic = $1 AND timestamp <= $2
        ORDER BY timestamp ASC
      `,
      [topic, now],
    );

    return rows.map((row) => ({
      id: row.id,
      key: row.key ?? undefined,
      topic: row.topic,
      value: Buffer.from(row.value, "base64"),
      timestamp: Number(row.timestamp),
    }));
  }

  public async ack(id: string): Promise<void> {
    await this.promise;

    await this.pool.query(`DELETE FROM kafka_delay_messages WHERE id = $1`, [id]);
  }

  // private

  private async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS kafka_delay_messages (
        id UUID PRIMARY KEY,
        key VARCHAR(64),
        topic VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        timestamp BIGINT NOT NULL
      );
    `);

    this.promise = Promise.resolve();
  }
}
