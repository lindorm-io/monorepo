import { createMockProteusSource } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

class TestEntity {
  id!: string;
}

describe("createMockProteusSource", () => {
  it("should create a mock source with all methods as vi.fn()", () => {
    const source = createMockProteusSource();

    expect(source).toMatchSnapshot();
  });

  it("should have correct default properties", () => {
    const source = createMockProteusSource();

    expect(source.namespace).toBeNull();
    expect(source.driverType).toBe("memory");
    expect(source.migrationsTable).toBeUndefined();
  });

  it("should return a mock repository from repository()", () => {
    const source = createMockProteusSource();
    const repo = source.repository(TestEntity);

    expect(repo).toBeDefined();
    expect(repo.find).toBeDefined();
    expect(vi.isMockFunction(repo.find)).toBe(true);
  });

  it("should return a new mock session from session()", () => {
    const source = createMockProteusSource();
    const session = source.session();

    expect(session).toBeDefined();
    expect(session).not.toBe(source);
    expect(session.namespace).toBeNull();
    expect(session.driverType).toBe("memory");
    expect(vi.isMockFunction(session.repository)).toBe(true);
  });

  it("should resolve true for ping()", async () => {
    const source = createMockProteusSource();

    expect(await source.ping()).toBe(true);
  });

  it("should execute transaction callback", async () => {
    const source = createMockProteusSource();
    const result = await source.transaction(async () => "done");

    expect(result).toBe("done");
  });

  it("should return an empty map for getFilterRegistry()", () => {
    const source = createMockProteusSource();
    const registry = source.getFilterRegistry();

    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });

  it("should return true by default for hasEntity()", () => {
    const source = createMockProteusSource();

    expect(source.hasEntity(TestEntity)).toBe(true);
  });

  it("should serve seeded rows through both source and session repositories", async () => {
    class Album {
      id!: string;
      artistId!: string;
    }

    const rows = {
      Album: [
        { id: "alb_1", artistId: "art_1" },
        { id: "alb_2", artistId: "art_1" },
        { id: "alb_3", artistId: "art_2" },
      ],
    };
    const source = createMockProteusSource(rows);

    // Directly off the source.
    expect(
      await source.repository(Album).findPaginated(
        { artistId: "art_1" } as any,
        {
          page: 1,
          pageSize: 1,
        } as any,
      ),
    ).toMatchObject({
      total: 2,
      data: [{ id: "alb_1", artistId: "art_1" }],
      hasMore: true,
    });

    // And through a session — the seed flows down.
    const repo = source.session().repository(Album);
    expect(await repo.count({ artistId: "art_2" } as any)).toBe(1);
  });
});
