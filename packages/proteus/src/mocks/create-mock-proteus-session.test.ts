import { describe, expect, it, vi } from "vitest";
import { Entity } from "../decorators/Entity.js";
import { Field } from "../decorators/Field.js";
import { Generated } from "../decorators/Generated.js";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField.js";
import { createMockProteusSession } from "./vitest.js";

// Memory-backed mocks require DECORATED entities registered on the source via the
// `entities` setting. The @Entity table names are file-unique to isolate the
// global registry.
@Entity({ name: "SessionMockTestEntity" })
class TestEntity {
  @PrimaryKeyField() @Generated("string") id!: string;

  @Field("string") value!: string;
}

@Entity({ name: "SessionMockAlbum" })
class Album {
  @PrimaryKeyField() @Generated("string") id!: string;

  @Field("string") artistId!: string;
}

describe("createMockProteusSession", () => {
  it("should create a mock session with all methods as vi.fn()", async () => {
    const session = await createMockProteusSession();

    // Snapshot the method surface WITHOUT `log`: the real mock logger records a
    // `child(["ProteusSource"])` call — a ProteusSource internal detail that
    // would make this snapshot brittle. Assert the logger is a real mock instead.
    const { log: _log, ...surface } = session as any;
    expect(surface).toMatchSnapshot();
    expect(vi.isMockFunction(session.log.info)).toBe(true);
    expect(vi.isMockFunction(session.log.child)).toBe(true);
  });

  it("should have correct default properties", async () => {
    const session = await createMockProteusSession();

    expect(session.namespace).toBeNull();
    expect(session.driverType).toBe("memory");
  });

  it("should return a mock repository from repository()", async () => {
    const session = await createMockProteusSession({ entities: [TestEntity] });
    const repo = session.repository(TestEntity);

    expect(repo).toBeDefined();
    expect(vi.isMockFunction(repo.find)).toBe(true);
  });

  it("should resolve true for ping()", async () => {
    const session = await createMockProteusSession();

    expect(await session.ping()).toBe(true);
  });

  it("should execute transaction callback", async () => {
    const session = await createMockProteusSession();
    const result = await session.transaction(async () => "done");

    expect(result).toBe("done");
  });

  it("should return an empty map for getFilterRegistry()", async () => {
    const session = await createMockProteusSession();
    const registry = session.getFilterRegistry();

    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });

  it("should return true by default for hasEntity()", async () => {
    const session = await createMockProteusSession({ entities: [TestEntity] });

    expect(session.hasEntity(TestEntity)).toBe(true);
  });

  it("should serve rows written through its repositories", async () => {
    const session = await createMockProteusSession({ entities: [TestEntity, Album] });

    await session.repository(Album).insert([
      { id: "alb_1", artistId: "art_1" },
      { id: "alb_2", artistId: "art_2" },
    ] as any);
    await session.repository(TestEntity).insert({ id: "te_1", value: "v" } as any);

    const albums = session.repository(Album);
    expect(await albums.findOne({ id: "alb_2" } as any)).toMatchObject({
      id: "alb_2",
      artistId: "art_2",
    });
    expect(await albums.find({ artistId: "art_1" } as any)).toMatchObject([
      { id: "alb_1", artistId: "art_1" },
    ]);

    const test = session.repository(TestEntity);
    expect(await test.findPaginated()).toMatchObject({
      total: 1,
      data: [{ id: "te_1" }],
    });
  });

  it("should serve empty results for an entity without any rows", async () => {
    const session = await createMockProteusSession({ entities: [TestEntity, Album] });
    await session.repository(Album).insert({ id: "alb_1", artistId: "a" } as any);

    const repo = session.repository(TestEntity);
    expect(await repo.find()).toEqual([]);
    expect(await repo.findOne({ id: "x" } as any)).toBeNull();
  });

  it("should persist writes across repository() calls within a session", async () => {
    const session = await createMockProteusSession({ entities: [TestEntity] });

    const inserted = await session
      .repository(TestEntity)
      .insert({ id: "te_1", value: "hello" } as any);
    expect(inserted).toMatchObject({ id: "te_1", value: "hello" });

    const found = await session.repository(TestEntity).findOne({ id: "te_1" } as any);
    expect(found).toMatchObject({ id: "te_1", value: "hello" });
  });

  it("should give each entity its own store within a session", async () => {
    const session = await createMockProteusSession({ entities: [TestEntity, Album] });

    await session.repository(TestEntity).insert({ id: "te_1", value: "x" } as any);

    // A different entity keeps its own fresh, empty store.
    expect(await session.repository(Album).count()).toBe(0);
    expect(await session.repository(TestEntity).count()).toBe(1);
  });
});
