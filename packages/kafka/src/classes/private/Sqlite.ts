import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { join } from "path";

type Envelope = {
  id: string;
  key?: string;
  topic: string;
  value: Buffer;
  timestamp: number;
};

type Delay = Omit<Envelope, "id" | "timestamp"> & {
  delay: number;
};

type Callback = (envelope: Envelope) => Promise<void>;

export class Sqlite {
  private readonly db: any;
  private readonly polls: Map<string, NodeJS.Timeout>;

  public constructor(directory: string) {
    this.db = new Database(join(directory, "kafka.db"));
    this.init();

    this.polls = new Map();
  }

  // public

  public delay(envelope: Delay): void {
    const statement = this.db.prepare(`
      INSERT INTO messages (id, key, topic, value, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    const timestamp = Date.now() + envelope.delay;

    statement.run(randomUUID(), envelope.key, envelope.topic, envelope.value, timestamp);
  }

  public poll(topic: string, callback: Callback): void {
    this.polls.set(
      topic,
      setInterval(() => {
        const rows = this.db
          .prepare("SELECT * FROM messages WHERE topic = ? AND timestamp <= ?")
          .all(topic, Date.now());

        for (const row of rows) {
          callback(row).then(() => {
            this.db.prepare("DELETE FROM messages WHERE id = ?").run(row.id);
          });
        }
      }, 500),
    );
  }

  public stop(topic: string): void {
    const poll = this.polls.get(topic);

    if (!poll) return;

    clearInterval(poll);
    this.polls.delete(topic);
  }

  public disconnect(): void {
    for (const poll of this.polls.values()) {
      clearInterval(poll);
    }
    this.polls.clear();
    this.db.close();
  }

  // private

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        key TEXT,
        topic TEXT NOT NULL,
        value BLOB NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  }
}
