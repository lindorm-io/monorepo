import { createMockProteusSession } from "./vitest.js";
import { describe, expect, it, vi } from "vitest";

class TestEntity {
  id!: string;
}

describe("createMockProteusSession", () => {
  it("should create a mock session with all methods as vi.fn()", () => {
    const session = createMockProteusSession();

    expect(session).toMatchSnapshot();
  });

  it("should have correct default properties", () => {
    const session = createMockProteusSession();

    expect(session.namespace).toBeNull();
    expect(session.driverType).toBe("memory");
  });

  it("should return a mock repository from repository()", () => {
    const session = createMockProteusSession();
    const repo = session.repository(TestEntity);

    expect(repo).toBeDefined();
    expect(vi.isMockFunction(repo.find)).toBe(true);
  });

  it("should resolve true for ping()", async () => {
    const session = createMockProteusSession();

    expect(await session.ping()).toBe(true);
  });

  it("should execute transaction callback", async () => {
    const session = createMockProteusSession();
    const result = await session.transaction(async () => "done");

    expect(result).toBe("done");
  });

  it("should return an empty map for getFilterRegistry()", () => {
    const session = createMockProteusSession();
    const registry = session.getFilterRegistry();

    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });

  it("should return true by default for hasEntity()", () => {
    const session = createMockProteusSession();

    expect(session.hasEntity(TestEntity)).toBe(true);
  });

  it("should serve seeded rows keyed by entity name through its repositories", async () => {
    class Album {
      id!: string;
      artistId!: string;
    }

    const session = createMockProteusSession({
      Album: [
        { id: "alb_1", artistId: "art_1" },
        { id: "alb_2", artistId: "art_2" },
      ],
      TestEntity: [{ id: "te_1" }],
    });

    const albums = session.repository(Album);
    expect(await albums.findOne({ id: "alb_2" } as any)).toEqual({
      id: "alb_2",
      artistId: "art_2",
    });
    expect(await albums.find({ artistId: "art_1" } as any)).toEqual([
      { id: "alb_1", artistId: "art_1" },
    ]);

    const test = session.repository(TestEntity);
    expect(await test.findPaginated()).toMatchObject({
      total: 1,
      data: [{ id: "te_1" }],
    });
  });

  it("should serve an empty page for an entity without seeded rows", async () => {
    const session = createMockProteusSession({ Album: [{ id: "alb_1" }] });
    const repo = session.repository(TestEntity);

    expect(await repo.find()).toEqual([]);
    expect(await repo.findOne({ id: "x" } as any)).toBeNull();
  });
});
