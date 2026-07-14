import { describe, expect, test, vi } from "vitest";
import { createTestPylonCtx } from "./vitest.js";

// A plain local class — no decorators. The mock store keys by `entity.name`.
class TestEntity {
  id!: string;
  value!: string;
}

describe("createTestPylonCtx", () => {
  test("should round-trip through the stateful mock db session", async () => {
    const ctx = createTestPylonCtx();

    const repository = ctx.db!.repository(TestEntity);

    const inserted = await repository.insert({ value: "hello" });
    expect(inserted.id).toEqual(expect.any(String));
    expect(inserted.value).toBe("hello");

    const found = await repository.findOne({ id: inserted.id });
    expect(found).not.toBeNull();
    expect(found?.value).toBe("hello");
  });

  test("should back db and kv with distinct stateful sessions", async () => {
    const ctx = createTestPylonCtx();

    expect(ctx.db).not.toBe(ctx.kv);

    const inserted = await ctx.db!.repository(TestEntity).insert({ value: "in-db" });

    // The kv session is a separate store — it does not see the db write.
    expect(await ctx.kv!.repository(TestEntity).findOne({ id: inserted.id })).toBeNull();
    // The db session persists across repository() calls.
    expect(
      await ctx.db!.repository(TestEntity).findOne({ id: inserted.id }),
    ).not.toBeNull();
  });

  test("should expose the ecosystem mocks", () => {
    const ctx = createTestPylonCtx();

    expect(vi.isMockFunction(ctx.aegis.jwt.sign)).toBe(true);
    expect(vi.isMockFunction(ctx.amphora.setup)).toBe(true);
    expect(vi.isMockFunction(ctx.logger.info)).toBe(true);
    expect(vi.isMockFunction(ctx.conduits.conduit.get)).toBe(true);
    expect(vi.isMockFunction(ctx.db!.repository(TestEntity).insert)).toBe(true);
  });

  test("should apply rich state defaults", () => {
    const ctx = createTestPylonCtx();

    expect(ctx.state.actor).toBe("test-actor");
    expect(ctx.state.app.environment).toBe("test");
    expect(ctx.state.authorization).toEqual({ type: "none", value: null });
    expect(ctx.state.metadata.date).toEqual(new Date(0));
    expect(ctx.state.metadata.id).toBe("test-id");
  });

  test("should deep-merge state overrides", () => {
    const ctx = createTestPylonCtx({
      state: { actor: "custom-actor", tenant: "tenant-1" },
    });

    expect(ctx.state.actor).toBe("custom-actor");
    expect(ctx.state.tenant).toBe("tenant-1");
    expect(ctx.state.app.environment).toBe("test");
  });

  test("should omit ctx.db when db is null", () => {
    const ctx = createTestPylonCtx({ db: null });

    expect(ctx.db).toBeUndefined();
    expect(ctx.kv).toBeDefined();
  });

  test("should use a provided session override", () => {
    const kv = createTestPylonCtx().kv!;
    const ctx = createTestPylonCtx({ kv });

    expect(ctx.kv).toBe(kv);
  });

  test("should write real challenges onto the mocked response", () => {
    const ctx = createTestPylonCtx();

    ctx.challenge("bearer", { realm: "lindorm.io", error: "insufficient_scope" });
    ctx.challenge("basic", { realm: "lindorm.io" });

    expect(ctx.response.headers).toMatchSnapshot();
  });

  test("should record response headers the way koa does", () => {
    const ctx = createTestPylonCtx();

    ctx.set("Cache-Control", "no-store");

    expect(ctx.response.get("cache-control")).toBe("no-store");
    expect(ctx.response.headers).toEqual({ "cache-control": "no-store" });
  });

  test("should flow data and params through", () => {
    const ctx = createTestPylonCtx({
      data: { foo: "bar" },
      params: { id: "123" },
    });

    expect(ctx.data).toEqual({ foo: "bar" });
    expect(ctx.params).toEqual({ id: "123" });
  });
});
