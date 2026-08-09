// A cached introspection or userinfo answer is DISPOSABLE — losing one costs a
// round trip — so both entities land in the evictable `cache` source, which
// falls back to `kv` when a deployment runs one ephemeral store. The KEK sealing
// them is still named per feature (`auth.encryption`). Driven against REAL
// sqlite sources and a REAL Amphora: which source a table landed in, and which
// key sealed it, cannot be asserted against a mock.

import { parseAes } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ProteusSource } from "@lindorm/proteus";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CachedIntrospection } from "../entities/CachedIntrospection.js";
import { CachedUserinfo } from "../entities/CachedUserinfo.js";
import { IDP_SETTINGS, nockIdp } from "../__fixtures__/idp.js";
import { OpenIdResourceDriver } from "../drivers/auth/OpenIdResourceDriver.js";
import type { PylonAuthSettings } from "../types/index.js";
import { Pylon } from "./Pylon.js";

const ISSUER = "http://test.lindorm.io";

// `OpenIdResourceDriver` pins `amphora.idp` — registered here so these pylons boot.
nockIdp();

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
    publish: false,
    purpose,
  });

const driver = (): PylonAuthSettings["driver"] =>
  new OpenIdResourceDriver({
    clientId: "client-id",
    clientSecret: "client-secret",
  });

const createPylon = (
  amphora: IAmphora,
  auth: PylonAuthSettings,
  kv?: ProteusSource,
  cache?: ProteusSource,
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
    cache: cache as any,
    auth,
  });

/**
 * The tables proteus synchronised onto this source — the only honest answer to
 * "did the entity land here?".
 *
 * `connect()` / `setup()` are idempotent, so calling them here after the pylon
 * has already run its own is safe — and it is what makes the assertion read the
 * schema as it stands once registration and KEK staging have happened.
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

  test("should register both cache entities on kv when no cache source is set", async () => {
    const amphora = new Amphora({
      internal: { issuer: ISSUER },
      idp: IDP_SETTINGS,
      logger: createMockLogger(),
    });
    amphora.add([createKek("pylon:kek")]);

    const kv = createSource(amphora);
    pylon = createPylon(amphora, { driver: driver(), cache: { enabled: true } }, kv);

    await pylon.setup();

    const tables = await tableNames(kv);

    expect(tables).toContain("CachedIntrospection");
    expect(tables).toContain("CachedUserinfo");
  });

  // `cache ?? kv` — the evictable source WINS when a deployment splits the two.
  test("should register both cache entities on cache, not kv, when the two are split", async () => {
    const amphora = new Amphora({
      internal: { issuer: ISSUER },
      idp: IDP_SETTINGS,
      logger: createMockLogger(),
    });
    amphora.add([createKek("pylon:kek")]);

    const kv = createSource(amphora);
    const cache = createSource(amphora);

    pylon = createPylon(
      amphora,
      { driver: driver(), cache: { enabled: true } },
      kv,
      cache,
    );

    await pylon.setup();

    const cacheTables = await tableNames(cache);
    const kvTables = await tableNames(kv);

    expect(cacheTables).toContain("CachedIntrospection");
    expect(cacheTables).toContain("CachedUserinfo");
    expect(kvTables).not.toContain("CachedIntrospection");
    expect(kvTables).not.toContain("CachedUserinfo");
  });

  // No ephemeral source at all ⇒ no cache, and setup must still succeed: a
  // deployment without one keeps calling the driver, uncached and without error.
  test("should set up without any ephemeral source", async () => {
    const amphora = new Amphora({
      internal: { issuer: ISSUER },
      idp: IDP_SETTINGS,
      logger: createMockLogger(),
    });
    amphora.add([createKek("pylon:kek")]);

    pylon = createPylon(amphora, { driver: driver(), cache: { enabled: true } });

    await expect(pylon.setup()).resolves.toBeUndefined();
  });

  // A separate blast radius for the cached credentials: `auth.encryption` names
  // its own KEK, and the default `pylon:kek` must NOT be the one that sealed it.
  test("should seal both payloads under auth.encryption", async () => {
    const amphora = new Amphora({
      internal: { issuer: ISSUER },
      idp: IDP_SETTINGS,
      logger: createMockLogger(),
    });
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
    const amphora = new Amphora({
      internal: { issuer: ISSUER },
      idp: IDP_SETTINGS,
      logger: createMockLogger(),
    });
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
