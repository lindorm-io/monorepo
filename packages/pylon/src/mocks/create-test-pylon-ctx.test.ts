import { Entity, Field, Generated, PrimaryKeyField } from "@lindorm/proteus";
import { describe, expect, test, vi } from "vitest";
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

  test("should back db and kv with distinct stateful sessions", async () => {
    const ctx = await createTestPylonCtx();

    expect(ctx.db).not.toBe(ctx.kv);

    const inserted = await ctx.db!.repository(TestEntity).insert({ value: "in-db" });

    // The kv session is a separate store — it does not see the db write.
    expect(await ctx.kv!.repository(TestEntity).findOne({ id: inserted.id })).toBeNull();
    // The db session persists across repository() calls.
    expect(
      await ctx.db!.repository(TestEntity).findOne({ id: inserted.id }),
    ).not.toBeNull();
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

  test("should flow data and params through", async () => {
    const ctx = await createTestPylonCtx({
      data: { foo: "bar" },
      params: { id: "123" },
    });

    expect(ctx.data).toEqual({ foo: "bar" });
    expect(ctx.params).toEqual({ id: "123" });
  });
});
