import { Entity, Field, Generated, PrimaryKeyField } from "@lindorm/proteus";
import { describe, expect, test, vi } from "vitest";
import { createTestPylonCtx } from "./vitest.js";

@Entity()
class TestEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  value!: string;
}

describe("createTestPylonCtx", () => {
  test("should round-trip through the real memory db session", async () => {
    const ctx = await createTestPylonCtx({ entities: [TestEntity] });

    const repository = ctx.db!.repository(TestEntity);

    const inserted = await repository.insert({ value: "hello" });
    expect(inserted.id).toEqual(expect.any(String));
    expect(inserted.value).toBe("hello");

    const found = await repository.findOne({ id: inserted.id });
    expect(found).not.toBeNull();
    expect(found?.value).toBe("hello");
  });

  test("should back ctx.kv with a real session on the same source", async () => {
    const ctx = await createTestPylonCtx({ entities: [TestEntity] });

    const inserted = await ctx.db!.repository(TestEntity).insert({ value: "shared" });

    const found = await ctx.kv!.repository(TestEntity).findOne({ id: inserted.id });
    expect(found?.value).toBe("shared");
  });

  test("should expose the ecosystem mocks", async () => {
    const ctx = await createTestPylonCtx();

    expect(vi.isMockFunction(ctx.aegis.jwt.sign)).toBe(true);
    expect(vi.isMockFunction(ctx.amphora.setup)).toBe(true);
    expect(vi.isMockFunction(ctx.logger.info)).toBe(true);
    expect(vi.isMockFunction(ctx.conduits.conduit.get)).toBe(true);
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

  test("should flow data and params through", async () => {
    const ctx = await createTestPylonCtx({
      data: { foo: "bar" },
      params: { id: "123" },
    });

    expect(ctx.data).toEqual({ foo: "bar" });
    expect(ctx.params).toEqual({ id: "123" });
  });
});
