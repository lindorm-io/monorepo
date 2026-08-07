// Storage for the driver-response caches sits on the FEATURE — `auth.kv` and
// `auth.encryption` — exactly like `session.kv` / `webhook.encryption`, and
// resolves as `auth.kv ?? kv`. Driven against REAL sqlite sources and a REAL
// Amphora: which source a table landed in, and which key sealed it, cannot be
// asserted against a mock.

import { parseAes } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CachedIntrospection } from "../entities/CachedIntrospection.js";
import { CachedUserinfo } from "../entities/CachedUserinfo.js";
import { OpenIdResourceDriver } from "../drivers/auth/OpenIdResourceDriver.js";
import type { PylonAuthSettings } from "../types/index.js";
import { Pylon } from "./Pylon.js";

const ISSUER = "http://test.lindorm.io";

let sources: Array<ProteusSource> = [];

const createSource = (amphora: IAmphora): ProteusSource => {
  const source = new ProteusSource({
    driver: "sqlite",
    filename: ":memory:",
    entities: [] as never,
    logger: createMockLogger(),
    synchronize: true,
    amphora,
  });
  sources.push(source);
  return source;
};

const createKek = (purpose: string): IKryptos =>
  KryptosKit.generate.enc.oct({
    algorithm: "A128KW",
    issuer: ISSUER,
    publish: false,
    purpose,
  });

const driver = (): PylonAuthSettings["driver"] =>
  new OpenIdResourceDriver({
    clientId: "client-id",
    clientSecret: "client-secret",
    issuer: ISSUER,
  });

const createPylon = (
  amphora: IAmphora,
  auth: PylonAuthSettings,
  kv?: ProteusSource,
): Pylon =>
  new Pylon({
    logger: createMockLogger(),
    amphora,
    domain: ISSUER,
    environment: "test",
    name: "@lindorm/pylon",
    port: 55597,
    version: "0.0.1",
    kv: kv as any,
    auth,
  });

/**
 * The tables proteus synchronised onto this source — the only honest answer to
 * "did the entity land here?".
 *
 * ⚠ Pylon connects the TOP-LEVEL `db`/`kv`/`bus` only; a feature-level source is
 * the consumer's to connect (pre-existing and uniform across `session.kv`,
 * `cache.kv`, `rateLimit.kv`), so the test connects it here — after `setup()`,
 * which is where the entity registration and KEK staging happened.
 */
const tableNames = async (source: ProteusSource): Promise<string> => {
  await source.connect();
  await source.setup();

  const client = await source.client<any>();

  return client
    .all("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((r: any) => r.name as string)
    .join("|");
};

const keyIdSealing = async (
  source: ProteusSource,
  id: string,
): Promise<string | null> => {
  const client = await source.client<any>();
  const tables: Array<string> = client
    .all("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((r: any) => r.name as string);

  for (const table of tables) {
    let row: any;
    try {
      row = client.get(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
    } catch {
      continue; // Table without an `id` column.
    }
    if (!row) continue;

    for (const value of Object.values(row)) {
      if (typeof value !== "string") continue;
      try {
        return parseAes(value).keyId;
      } catch {
        // Not a cipher — keep looking.
      }
    }
  }

  return null;
};

describe("Pylon auth cache storage", () => {
  let pylon: Pylon;

  afterEach(async () => {
    await pylon?.teardown();
    await Promise.all(sources.map((s) => s.disconnect()));
    sources = [];
    vi.clearAllMocks();
  });

  test("should register both cache entities on the top-level kv when auth names none", async () => {
    const amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    amphora.add([createKek("pylon:kek")]);

    const kv = createSource(amphora);
    pylon = createPylon(amphora, { driver: driver(), cache: { enabled: true } }, kv);

    await pylon.setup();

    const tables = await tableNames(kv);

    expect(tables).toContain("CachedIntrospection");
    expect(tables).toContain("CachedUserinfo");
  });

  // `auth.kv ?? kv`, in that order — the feature-level source WINS.
  test("should honour auth.kv over the top-level kv", async () => {
    const amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    amphora.add([createKek("pylon:kek")]);

    const authKv = createSource(amphora);
    const fallbackKv = createSource(amphora);

    pylon = createPylon(
      amphora,
      { driver: driver(), kv: authKv as any, cache: { enabled: true } },
      fallbackKv,
    );

    await pylon.setup();

    const auth = await tableNames(authKv);
    const fallback = await tableNames(fallbackKv);

    expect(auth).toContain("CachedIntrospection");
    expect(auth).toContain("CachedUserinfo");
    expect(fallback).not.toContain("CachedIntrospection");
    expect(fallback).not.toContain("CachedUserinfo");
  });

  // No source at either level ⇒ no cache, and setup must still succeed: a
  // deployment without a kv keeps calling the driver, uncached and without error.
  test("should set up without a source at either level", async () => {
    const amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    amphora.add([createKek("pylon:kek")]);

    pylon = createPylon(amphora, { driver: driver(), cache: { enabled: true } });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });

  // A separate blast radius for the cached credentials: `auth.encryption` names
  // its own KEK, and the default `pylon:kek` must NOT be the one that sealed it.
  test("should seal both payloads under auth.encryption", async () => {
    const amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    const bootstrap = createKek("pylon:kek");
    const authKek = createKek("pylon:auth-cache");
    amphora.add([bootstrap, authKek]);

    const kv = createSource(amphora);
    pylon = createPylon(
      amphora,
      {
        driver: driver(),
        encryption: { condition: { purpose: "pylon:auth-cache" } },
        cache: { enabled: true },
      },
      kv,
    );

    await pylon.setup();

    const introspection = kv.repository(CachedIntrospection);
    const introspectionRow = await introspection.insert(
      introspection.create({
        id: "introspection-entry",
        expiresAt: new Date(Date.now() + 10_000),
        payload: { active: true, claims: { sub: "alice" } },
      }) as CachedIntrospection,
    );

    const userinfo = kv.repository(CachedUserinfo);
    const userinfoRow = await userinfo.insert(
      userinfo.create({
        id: "userinfo-entry",
        expiresAt: new Date(Date.now() + 10_000),
        payload: { claims: { subject: "alice" } },
      }) as CachedUserinfo,
    );

    expect(await keyIdSealing(kv, introspectionRow.id)).toBe(authKek.id);
    expect(await keyIdSealing(kv, userinfoRow.id)).toBe(authKek.id);
    expect(authKek.id).not.toBe(bootstrap.id);
  });

  // A concern switched off gets no table at all — dead schema is still schema.
  test("should register only the concern that is switched on", async () => {
    const amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    amphora.add([createKek("pylon:kek")]);

    const kv = createSource(amphora);
    pylon = createPylon(
      amphora,
      { driver: driver(), cache: { enabled: true, introspection: false } },
      kv,
    );

    await pylon.setup();

    const tables = await tableNames(kv);

    expect(tables).toContain("CachedUserinfo");
    expect(tables).not.toContain("CachedIntrospection");
  });
});
