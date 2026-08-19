import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { Entity, Field, Generated, PrimaryKeyField } from "@lindorm/proteus";
import { describe, expect, test, vi } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../__fixtures__/access/aegis.js";
import {
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  introspectionAnswer,
} from "../__fixtures__/access/tokens.js";
import { createTestAuthConfig } from "../__fixtures__/app-config.js";
import { useAccessToken } from "../middleware/common/use-access-token.js";
import { createTestPylonCtx } from "./vitest.js";

// The mock db session is backed by the real in-memory Proteus driver, so the
// entity must be DECORATED to ride the memory path.
@Entity({ name: "PylonCtxTestEntity" })
class TestEntity {
  @PrimaryKeyField() @Generated("string") id!: string;

  @Field("string") value!: string;
}

describe("createTestPylonCtx", () => {
  test("should round-trip through the stateful mock db session", async () => {
    const ctx = await createTestPylonCtx();

    const repository = ctx.db!.repository(TestEntity);

    const inserted = await repository.insert({ value: "hello" });
    expect(inserted.id).toEqual(expect.any(String));
    expect(inserted.value).toBe("hello");

    const found = await repository.findOne({ id: inserted.id });
    expect(found).not.toBeNull();
    expect(found?.value).toBe("hello");
  });

  // Three DISTINCT stores, so a test can prove which one a consumer wrote to —
  // the whole point of splitting the evictable `cache` off the authoritative
  // `kv` is lost if a test cannot tell them apart.
  test("should back db, kv and cache with distinct stateful sessions", async () => {
    const ctx = await createTestPylonCtx();

    expect(ctx.db).not.toBe(ctx.kv);
    expect(ctx.cache).not.toBe(ctx.kv);
    expect(ctx.cache).not.toBe(ctx.db);

    const inserted = await ctx.db!.repository(TestEntity).insert({ value: "in-db" });

    // Neither ephemeral session sees the db write.
    expect(await ctx.kv!.repository(TestEntity).findOne({ id: inserted.id })).toBeNull();
    expect(
      await ctx.cache!.repository(TestEntity).findOne({ id: inserted.id }),
    ).toBeNull();
    // The db session persists across repository() calls.
    expect(
      await ctx.db!.repository(TestEntity).findOne({ id: inserted.id }),
    ).not.toBeNull();
  });

  test("should omit ctx.cache when cache is null", async () => {
    const ctx = await createTestPylonCtx({ cache: null });

    expect(ctx.cache).toBeUndefined();
    expect(ctx.kv).toBeDefined();
  });

  test("should use a provided cache session override", async () => {
    const cache = (await createTestPylonCtx()).cache!;
    const ctx = await createTestPylonCtx({ cache });

    expect(ctx.cache).toBe(cache);
  });

  test("should expose the ecosystem mocks", async () => {
    const ctx = await createTestPylonCtx();

    expect(vi.isMockFunction(ctx.aegis.jwt.sign)).toBe(true);
    expect(vi.isMockFunction(ctx.amphora.setup)).toBe(true);
    expect(vi.isMockFunction(ctx.logger.info)).toBe(true);
    expect(vi.isMockFunction(ctx.conduits.conduit.get)).toBe(true);
    expect(vi.isMockFunction(ctx.db!.repository(TestEntity).insert)).toBe(true);
  });

  test("should apply rich state defaults", async () => {
    const ctx = await createTestPylonCtx();

    expect(ctx.state.actor).toBe("test-actor");
    expect(ctx.state.app.environment).toBe("test");
    expect(ctx.state.authorization).toEqual({ type: "none", value: null });
    expect(ctx.state.metadata.date).toEqual(new Date(0));
    expect(ctx.state.metadata.id).toBe("test-id");
  });

  test("should deep-merge state overrides", async () => {
    const ctx = await createTestPylonCtx({
      state: { actor: "custom-actor", tenant: "tenant-1" },
    });

    expect(ctx.state.actor).toBe("custom-actor");
    expect(ctx.state.tenant).toBe("tenant-1");
    expect(ctx.state.app.environment).toBe("test");
  });

  test("should omit ctx.db when db is null", async () => {
    const ctx = await createTestPylonCtx({ db: null });

    expect(ctx.db).toBeUndefined();
    expect(ctx.kv).toBeDefined();
  });

  test("should use a provided session override", async () => {
    const kv = (await createTestPylonCtx()).kv!;
    const ctx = await createTestPylonCtx({ kv });

    expect(ctx.kv).toBe(kv);
  });

  test("should write real challenges onto the mocked response", async () => {
    const ctx = await createTestPylonCtx();

    ctx.challenge("bearer", { realm: "lindorm.io", error: "insufficient_scope" });
    ctx.challenge("basic", { realm: "lindorm.io" });

    expect(ctx.response.headers).toMatchSnapshot();
  });

  test("should record response headers the way koa does", async () => {
    const ctx = await createTestPylonCtx();

    ctx.set("Cache-Control", "no-store");

    expect(ctx.response.get("cache-control")).toBe("no-store");
    expect(ctx.response.headers).toEqual({ "cache-control": "no-store" });
  });

  /**
   * The mock must be able to STATE which transport it is. Pylon discriminates
   * structurally (`isHttpContext` = `"request" in ctx && !("event" in ctx)`), so
   * a ctx with no `request` is not HTTP, not a socket, and not a handshake — and
   * `useAccessToken` answered `unsupported_context` for every request driven
   * through it. That is a rejection about the CONTEXT, not about the credential,
   * so a consumer proving its own auth wiring learned nothing from it.
   *
   * A REAL Aegis and a REAL access token, because the outcome under test is that
   * the middleware ran the HTTP arm to completion — a mocked verify would answer
   * whatever it was told and prove nothing about which arm reached it.
   */
  test("should express an HTTP context, so useAccessToken runs the HTTP arm", async () => {
    const aegis = createTestAegis(createMockLogger());

    const ctx = await createTestPylonCtx({
      aegis,
      state: {
        // `auth` is a nullable block, so `DeepPartial` stops recursing at it —
        // the whole block is stated, from the fixture that owns its defaults.
        app: { config: { auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }) } },
        authorization: { type: "bearer", value: await mintTestAccessToken(aegis) },
      },
    });

    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.state.access?.provenance).toBe("verified");
    expect(ctx.state.access?.claims.subject).toBe("alice");
    expect(next).toHaveBeenCalledTimes(1);
  });

  // The three fields are read by `useRateLimit` (`ip`) and `useAuditLog`
  // (`ip`/`method`/`path`), so a consumer mounting either gets a value rather
  // than a crash — and can overwrite one, since it is a plain object.
  test("should carry the request fields the common middleware reads", async () => {
    const ctx = await createTestPylonCtx();

    expect(ctx.request).toEqual({ ip: "127.0.0.1", method: "GET", path: "/" });
  });

  /**
   * `ctx.auth` stays MOCKED — a test that wants different behaviour re-programmes
   * the member on the ctx. What this asserts is that the re-programming is
   * REACHED by the middleware chain, and that it takes no cast: the mock API is
   * on the type, so this is verbatim what a consumer writes.
   *
   * The chain, not the mock, is the subject. Asserting `introspect` was called
   * with some argument bag would prove only that the mock agreed with itself —
   * the outcome (`provenance: "introspected"`, the answer's own subject) is what
   * proves the overridden answer travelled all the way through `resolveAccess`.
   */
  test("should let a test re-programme ctx.auth.introspect, with the chain seeing the answer", async () => {
    const ctx = await createTestPylonCtx({
      state: {
        app: { config: { auth: createTestAuthConfig() } },
        authorization: { type: "bearer", value: OPAQUE_TOKEN },
      },
    });

    ctx.auth.introspect.mockResolvedValue(introspectionAnswer());

    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.state.access?.provenance).toBe("introspected");
    expect(ctx.state.access?.claims.subject).toBe("alice");
    expect(next).toHaveBeenCalledTimes(1);
  });

  // The control that makes the test above mean something: the SAME context
  // WITHOUT the override is refused, because `introspect` defaults to a negative
  // answer. So acceptance is the re-programming being reached, not the mock
  // waving everything through.
  test("should refuse the same credential when introspect is left at its default", async () => {
    const ctx = await createTestPylonCtx({
      state: {
        app: { config: { auth: createTestAuthConfig() } },
        authorization: { type: "bearer", value: OPAQUE_TOKEN },
      },
    });

    const next = vi.fn();

    await expect(
      useAccessToken({ audience: ACCESS_TEST_AUDIENCE })(ctx, next),
    ).rejects.toMatchObject({ status: 401, code: "token_not_active" });

    expect(next).not.toHaveBeenCalled();
  });

  // The fixture is a BASELINE, not a finished context. `ctx.get` is a mock
  // returning "" — Koa's answer for an absent header — and a test that needs a
  // header states it here rather than the factory anticipating it.
  test("should let a test programme ctx.get per field", async () => {
    const ctx = await createTestPylonCtx();

    expect(ctx.get("DPoP")).toBe("");

    ctx.get.mockImplementation((field: string) =>
      field.toLowerCase() === "dpop" ? "proof-jwt" : "",
    );

    expect(ctx.get("DPoP")).toBe("proof-jwt");
    expect(ctx.get("Authorization")).toBe("");
  });

  test("should flow data and params through", async () => {
    const ctx = await createTestPylonCtx({
      data: { foo: "bar" },
      params: { id: "123" },
    });

    expect(ctx.data).toEqual({ foo: "bar" });
    expect(ctx.params).toEqual({ id: "123" });
  });
});
