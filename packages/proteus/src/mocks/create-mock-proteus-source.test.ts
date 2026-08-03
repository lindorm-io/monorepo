import { describe, expect, it, vi } from "vitest";
import { MemoryCacheAdapter } from "../classes/MemoryCacheAdapter.js";
import { BeforeInsert } from "../decorators/BeforeInsert.js";
import { Entity } from "../decorators/Entity.js";
import { Field } from "../decorators/Field.js";
import { Generated } from "../decorators/Generated.js";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField.js";
import { createMockProteusSource } from "./vitest.js";

@Entity({ name: "SourceMockTestEntity" })
class TestEntity {
  @PrimaryKeyField() @Generated("string") id!: string;
}

@Entity({ name: "SourceMockAlbum" })
class Album {
  @PrimaryKeyField() @Generated("string") id!: string;

  @Field("string") artistId!: string;
}

const hookMeta = vi.fn();

@Entity({ name: "SourceMockAudited" })
@BeforeInsert(hookMeta)
class Audited {
  @PrimaryKeyField() @Generated("string") id!: string;
}

describe("createMockProteusSource", () => {
  it("should create a mock source with all methods as vi.fn()", async () => {
    const source = await createMockProteusSource();

    // Snapshot the method surface WITHOUT `log`: the real mock logger records a
    // `child(["ProteusSource"])` call — a ProteusSource internal detail that
    // would make this snapshot brittle. Assert the logger is a real mock instead.
    const { log: _log, ...surface } = source as any;
    expect(surface).toMatchSnapshot();
    expect(vi.isMockFunction(source.log.info)).toBe(true);
    expect(vi.isMockFunction(source.log.child)).toBe(true);
  });

  it("should have correct default properties", async () => {
    const source = await createMockProteusSource();

    expect(source.namespace).toBeNull();
    expect(source.driverType).toBe("memory");
    expect(source.migrationsTable).toBeUndefined();
  });

  it("should return a mock repository from repository()", async () => {
    const source = await createMockProteusSource({ entities: [TestEntity] });
    const repo = source.repository(TestEntity);

    expect(repo).toBeDefined();
    expect(repo.find).toBeDefined();
    expect(vi.isMockFunction(repo.find)).toBe(true);
  });

  it("should return a new mock session from session()", async () => {
    const source = await createMockProteusSource();
    const session = source.session();

    expect(session).toBeDefined();
    expect(session).not.toBe(source);
    expect(session.namespace).toBeNull();
    expect(session.driverType).toBe("memory");
    expect(vi.isMockFunction(session.repository)).toBe(true);
  });

  it("should resolve true for ping()", async () => {
    const source = await createMockProteusSource();

    expect(await source.ping()).toBe(true);
  });

  it("should execute transaction callback", async () => {
    const source = await createMockProteusSource();
    const result = await source.transaction(async () => "done");

    expect(result).toBe("done");
  });

  it("should return an empty map for getFilterRegistry()", async () => {
    const source = await createMockProteusSource();
    const registry = source.getFilterRegistry();

    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });

  it("should return true by default for hasEntity()", async () => {
    const source = await createMockProteusSource({ entities: [TestEntity] });

    expect(source.hasEntity(TestEntity)).toBe(true);
  });

  it("should serve rows written through both source and session repositories", async () => {
    const source = await createMockProteusSource({ entities: [Album] });

    await source.repository(Album).insert([
      { id: "alb_1", artistId: "art_1" },
      { id: "alb_2", artistId: "art_1" },
      { id: "alb_3", artistId: "art_2" },
    ] as any);

    // Directly off the source.
    const page = await source.repository(Album).findPaginated(
      { artistId: "art_1" } as any,
      {
        page: 1,
        pageSize: 1,
      } as any,
    );
    expect(page).toMatchObject({ total: 2, hasMore: true });
    expect(page.data).toHaveLength(1);

    // And through a session — the store flows down (shared driver store).
    const repo = source.session().repository(Album);
    expect(await repo.count({ artistId: "art_2" } as any)).toBe(1);
  });

  // The mock settings are the real source settings minus `driver` and `breaker`;
  // anything short of that is a consumer whose app wiring cannot be reproduced
  // in a test at all.
  describe("settings pass-through", () => {
    it("should apply the naming strategy to column names", async () => {
      const source = await createMockProteusSource({
        entities: [Album],
        naming: "snake",
      });

      const [metadata] = source.getEntityMetadata();
      const field = metadata.fields.find((f) => f.key === "artistId");

      expect(field?.name).toBe("artist_id");
    });

    it("should route cached queries through the supplied cache adapter", async () => {
      const adapter = new MemoryCacheAdapter();
      const setSpy = vi.spyOn(adapter, "set");

      const source = await createMockProteusSource({
        entities: [Album],
        cache: { adapter, ttl: "1 minute" },
      });

      await source.repository(Album).insert({ id: "alb_1", artistId: "art_1" } as any);
      await source
        .repository(Album)
        .find({ artistId: "art_1" } as any, { cache: true } as any);

      expect(setSpy).toHaveBeenCalled();
    });

    it("should thread the hook meta into entity hooks", async () => {
      const meta = {
        correlationId: "cor_1",
        actor: "act_1",
        timestamp: new Date("2026-08-03T00:00:00.000Z"),
      };
      const source = await createMockProteusSource({ entities: [Audited], meta });

      await source.repository(Audited).insert({} as any);

      expect(hookMeta).toHaveBeenCalledWith(expect.any(Object), meta);
    });
  });
});
