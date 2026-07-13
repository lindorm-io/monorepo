// End-to-end proof that a @Sensitive value never reaches the LOGS — the claim the
// decorator makes, verified rather than asserted.
//
// The redaction work covers proteus' error payloads, on the premise that proteus never
// logs a field value in the first place (it parameterises every statement and logs the
// SQL text only). This test holds that premise to a real database at the LOUDEST log
// level: it captures every line proteus emits across a full lifecycle — schema sync,
// insert, find, update, upsert, delete, plus a duplicate-key failure — and asserts the
// secret appears in none of them.
//
// The `logsProduced` assertion keeps it honest: it proves proteus really was logging
// during the run, so a pass means "logged plenty, leaked nothing" rather than "logged
// nothing at all".

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import {
  Entity,
  Field,
  Generated,
  PrimaryKeyField,
  Sensitive,
  Unique,
} from "../../decorators/index.js";
import { ProteusSource } from "../../classes/ProteusSource.js";

vi.setConfig({ testTimeout: 120_000 });

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

const SECRET = "hunter2-super-secret-token";
const PUBLIC_VALUE = "public-column-value";

@Entity({ name: "SensitiveLogItem" })
class SensitiveLogItem {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Unique({ name: "uq_sensitive_log_item_hash" })
  @Sensitive()
  @Field("string")
  tokenHash!: string;

  @Field("string")
  name!: string;
}

describe("@Sensitive: no value reaches the logs (postgres)", () => {
  let source: ProteusSource;
  let logs: Array<unknown>;

  const logged = (): string => JSON.stringify(logs);

  const namespace = "sensitive_logging";

  beforeAll(async () => {
    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await raw.query(`CREATE SCHEMA "${namespace}"`);
    await raw.end();

    logs = [];

    source = new ProteusSource({
      driver: "postgres",
      url: PG_CONNECTION,
      namespace,
      naming: "snake",
      synchronize: true,
      entities: [SensitiveLogItem],
      // capture EVERYTHING proteus emits
      logger: createMockLogger((...args: Array<unknown>) => logs.push(args)),
    });

    await source.connect();
    await source.setup();
  });

  afterAll(async () => {
    if (source) await source.disconnect();

    const raw = new Client({ connectionString: PG_CONNECTION });
    await raw.connect();
    await raw.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await raw.end();
  });

  test("no lifecycle operation writes the sensitive value to a log", async () => {
    const repository = source.repository(SensitiveLogItem);

    const created = await repository.insert(
      repository.create({ tokenHash: SECRET, name: PUBLIC_VALUE }),
    );

    await repository.find({ id: created.id });
    await repository.findOne({ tokenHash: SECRET });

    created.name = "renamed";
    await repository.update(created);

    await repository.upsert(
      repository.create({ tokenHash: `${SECRET}-2`, name: PUBLIC_VALUE }),
    );

    // a duplicate insert: the driver error carries the conflicting value
    await expect(
      repository.insert(repository.create({ tokenHash: SECRET, name: "dupe" })),
    ).rejects.toThrow();

    await repository.destroy(created);

    // the run really did log (schema sync + per-statement debug), so the assertions
    // below mean "logged plenty, leaked nothing"
    expect(logs.length).toBeGreaterThan(0);

    expect(logged()).not.toContain(SECRET);
  });
});
