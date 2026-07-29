import { describe, expect, test, vi } from "vitest";
import { CreateDateField } from "../decorators/CreateDateField.js";
import { Entity } from "../decorators/Entity.js";
import { Field } from "../decorators/Field.js";
import { Generated } from "../decorators/Generated.js";
import { PrimaryKeyField } from "../decorators/PrimaryKeyField.js";
import { UpdateDateField } from "../decorators/UpdateDateField.js";
import { VersionField } from "../decorators/VersionField.js";
import { createMockRepository } from "./vitest.js";

// A decorated entity rides the real in-memory driver — that is the whole point
// of the memory-backed mock. `id` uses "string" generation so inserted rows may
// carry human-readable ids without tripping uuid validation. The version + date
// fields make it a realistic production entity: the real save-strategy relies on
// them to resolve insert-vs-update and to enforce optimistic locking.
@Entity({ name: "MockRepoAlbum" })
class Album {
  @PrimaryKeyField() @Generated("string") id!: string;

  @VersionField() version!: number;

  @CreateDateField() createdAt!: Date;

  @UpdateDateField() updatedAt!: Date;

  @Field("string") artistId!: string;

  @Field("integer") year!: number;
}

// A richer entity exercising client-side + persisted generation: a non-PK
// `@Generated("lindorm_id")` handle, a version, and create/update dates.
@Entity({ name: "MockRepoSession" })
class SessionEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Generated("lindorm_id") @Field("string") sessionId!: string;

  @Field("string") name!: string;

  @VersionField() version!: number;

  @CreateDateField() createdAt!: Date;

  @UpdateDateField() updatedAt!: Date;
}

describe("createMockRepository", () => {
  describe("bare stub (no entity)", () => {
    test("should create a mock with all methods as vi.fn()", async () => {
      const repo = await createMockRepository();

      expect(repo).toMatchSnapshot();
    });

    test("create / copy mint an id when omitted and preserve a supplied id", async () => {
      const repo = await createMockRepository();

      expect(repo.create({ name: "test" } as any)).toEqual({
        name: "test",
        id: expect.any(String),
      });
      expect(repo.copy({ name: "y" } as any).id).toEqual(expect.any(String));

      // A caller-supplied id is never overwritten.
      expect(repo.create({ id: "keep-me", name: "z" } as any).id).toBe("keep-me");
      expect(repo.copy({ id: "keep-me", name: "z" } as any).id).toBe("keep-me");
    });

    test("should return sensible defaults for scalar queries", async () => {
      const repo = await createMockRepository();

      expect(await repo.count()).toBe(1);
      expect(await repo.exists({} as any)).toBe(true);
      expect(await repo.find({} as any)).toEqual([]);
      expect(await repo.findOne({} as any)).toBeNull();
      expect(await repo.ttl({} as any)).toBe(60);
    });

    test("should echo entities for write methods", async () => {
      const repo = await createMockRepository();
      const entity = { id: "test-1" };

      expect(await repo.insert(entity as any)).toBe(entity);
      expect(await repo.save(entity as any)).toBe(entity);
      expect(await repo.update(entity as any)).toBe(entity);
      expect(await repo.upsert(entity as any)).toBe(entity);
    });

    test("should return sensible defaults for aggregate methods", async () => {
      const repo = await createMockRepository();

      expect(await repo.sum("id" as any)).toBeNull();
      expect(await repo.average("id" as any)).toBeNull();
      expect(await repo.minimum("id" as any)).toBeNull();
      expect(await repo.maximum("id" as any)).toBeNull();
    });

    test("should return sensible defaults for pagination methods", async () => {
      const repo = await createMockRepository();

      expect(await repo.paginate()).toMatchSnapshot();
      expect(await repo.findPaginated()).toMatchSnapshot();
    });

    test("defaults remain overridable", async () => {
      const repo = await createMockRepository();
      repo.findOne.mockResolvedValueOnce({ id: "override" } as never);

      expect(await repo.findOne({} as any)).toEqual({ id: "override" });
      expect(vi.isMockFunction(repo.findOne)).toBe(true);
    });
  });

  describe("memory-backed (decorated entity)", () => {
    const seed = (repo: Awaited<ReturnType<typeof createMockRepository<Album>>>) =>
      repo.insert([
        { id: "alb_1", artistId: "art_1", year: 1986 },
        { id: "alb_2", artistId: "art_1", year: 1988 },
        { id: "alb_3", artistId: "art_2", year: 1991 },
      ] as any);

    test("findOne matches by predicate and returns null when absent", async () => {
      const repo = await createMockRepository(Album);
      await seed(repo);

      expect(await repo.findOne({ id: "alb_2" } as any)).toMatchObject({
        id: "alb_2",
        artistId: "art_1",
        year: 1988,
      });
      expect(await repo.findOne({ id: "nope" } as any)).toBeNull();
    });

    test("find filters by criteria and honours limit", async () => {
      const repo = await createMockRepository(Album);
      await seed(repo);

      const byArtist = await repo.find({ artistId: "art_1" } as any);
      expect(byArtist).toHaveLength(2);
      expect(byArtist.map((r: any) => r.id).sort()).toEqual(["alb_1", "alb_2"]);

      expect(await repo.find(undefined, { limit: 1 } as any)).toHaveLength(1);
    });

    test("count / exists / findAndCount reflect the seeded rows", async () => {
      const repo = await createMockRepository(Album);
      await seed(repo);

      expect(await repo.count({ artistId: "art_1" } as any)).toBe(2);
      expect(await repo.exists({ artistId: "art_2" } as any)).toBe(true);
      expect(await repo.exists({ artistId: "nope" } as any)).toBe(false);

      const [found, total] = await repo.findAndCount({ artistId: "art_1" } as any);
      expect(total).toBe(2);
      expect(found).toHaveLength(2);
    });

    test("findPaginated pages, filters, and reports metadata", async () => {
      const repo = await createMockRepository(Album);
      await seed(repo);

      const page = await repo.findPaginated(undefined, { page: 1, pageSize: 2 } as any);
      expect(page).toMatchObject({
        total: 3,
        page: 1,
        pageSize: 2,
        totalPages: 2,
        hasMore: true,
      });
      expect(page.data).toHaveLength(2);
    });

    test("an empty store serves empty results, not a factory echo", async () => {
      const repo = await createMockRepository(Album);

      expect(await repo.find({ artistId: "x" } as any)).toEqual([]);
      expect(await repo.findOne({ id: "x" } as any)).toBeNull();
      expect(await repo.count()).toBe(0);
    });

    test("defaults remain overridable", async () => {
      const repo = await createMockRepository(Album);
      await seed(repo);
      repo.findOne.mockResolvedValueOnce({ id: "override" } as never);

      expect(await repo.findOne({ id: "alb_1" } as any)).toEqual({ id: "override" });
    });
  });

  describe("memory-backed — writes persist through the real driver", () => {
    test("insert persists and findOne round-trips (generated id)", async () => {
      const repo = await createMockRepository(Album);

      const inserted = await repo.insert({ artistId: "art_9", year: 2001 } as any);
      expect(inserted.id).toEqual(expect.any(String));

      const found = await repo.findOne({ id: inserted.id } as any);
      expect(found).toMatchObject({ id: inserted.id, artistId: "art_9", year: 2001 });
    });

    test("insert honours a provided id and does not mutate the caller's input", async () => {
      const repo = await createMockRepository(Album);
      const input = { id: "row_1", artistId: "a", year: 1 };

      const inserted = await repo.insert(input as any);
      expect(inserted).not.toBe(input);
      expect(await repo.findOne({ id: "row_1" } as any)).toMatchObject(input);
    });

    test("insert accepts an array and returns each stored row", async () => {
      const repo = await createMockRepository(Album);

      const result = await repo.insert([
        { artistId: "a", year: 1 },
        { artistId: "b", year: 2 },
      ] as any);
      expect(result).toHaveLength(2);
      expect(await repo.count()).toBe(2);
    });

    test("save / upsert update in place by id, else insert", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert({ id: "row_1", artistId: "old", year: 1 } as any);

      // Read-modify-write: the real driver enforces optimistic locking on the
      // @VersionField, so update the row we read (carrying its version) — not a
      // hand-built partial.
      const found = (await repo.findOne({ id: "row_1" } as any))!;
      found.artistId = "new";
      const saved = await repo.save(found);
      expect(saved).toMatchObject({ id: "row_1", artistId: "new" });
      expect(await repo.count()).toBe(1);

      const created = await repo.upsert({
        id: "row_2",
        artistId: "fresh",
        year: 3,
      } as any);
      expect(created).toMatchObject({ id: "row_2" });
      expect(await repo.count()).toBe(2);
    });

    test("update bumps the version and merges onto the stored row", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert({ id: "row_1", artistId: "old", year: 1 } as any);

      const found = (await repo.findOne({ id: "row_1" } as any))!;
      expect(found.version).toBe(1);

      found.artistId = "new";
      found.year = 9;
      const updated = await repo.update(found);
      expect(updated).toMatchObject({ id: "row_1", artistId: "new", year: 9 });
      expect(updated.version).toBe(2);
    });

    test("update changing one field leaves an untouched third field intact", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert({ id: "row_1", artistId: "keep", year: 1 } as any);

      // Change only `year`; `artistId` is neither read nor written by this update
      // and must remain intact on the stored row (merge, not replace).
      const found = (await repo.findOne({ id: "row_1" } as any))!;
      found.year = 42;
      const updated = await repo.update(found);
      expect(updated).toMatchObject({ id: "row_1", artistId: "keep", year: 42 });

      expect((await repo.findOne({ id: "row_1" } as any))?.artistId).toBe("keep");
    });

    test("destroy / delete remove matching rows", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert([
        { id: "row_1", artistId: "a", year: 1 },
        { id: "row_2", artistId: "b", year: 2 },
        { id: "row_3", artistId: "b", year: 3 },
      ] as any);

      const row1 = (await repo.findOne({ id: "row_1" } as any))!;
      await repo.destroy(row1);
      expect(await repo.findOne({ id: "row_1" } as any)).toBeNull();

      await repo.delete({ artistId: "b" } as any);
      expect(await repo.count()).toBe(0);
    });

    test("increment / decrement adjust matched rows", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert({ id: "row_1", artistId: "a", year: 5 } as any);

      await repo.increment({ id: "row_1" } as any, "year" as any, 3);
      expect((await repo.findOne({ id: "row_1" } as any))?.year).toBe(8);

      await repo.decrement({ id: "row_1" } as any, "year" as any, 2);
      expect((await repo.findOne({ id: "row_1" } as any))?.year).toBe(6);
    });

    test("updateMany assigns to all matched rows", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert([
        { id: "row_1", artistId: "a", year: 1 },
        { id: "row_2", artistId: "a", year: 2 },
      ] as any);

      await repo.updateMany({ artistId: "a" } as any, { artistId: "z" } as any);
      expect(await repo.count({ artistId: "z" } as any)).toBe(2);
    });

    test("findOneOrSave returns the existing match, else inserts", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert({ id: "row_1", artistId: "existing", year: 1 } as any);

      expect(
        await repo.findOneOrSave(
          { id: "row_1" } as any,
          {
            artistId: "x",
            year: 0,
          } as any,
        ),
      ).toMatchObject({ id: "row_1", artistId: "existing" });

      // No match: save the new entity. Its PK is left unset so the real driver's
      // save-strategy mints it and INSERTs.
      const saved = await repo.findOneOrSave(
        { artistId: "new" } as any,
        {
          artistId: "new",
          year: 9,
        } as any,
      );
      expect(saved).toMatchObject({ artistId: "new" });
      expect(saved.id).toEqual(expect.any(String));
      expect(await repo.count()).toBe(2);
    });

    test("findOneOrFail throws when nothing matches", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert({ id: "row_1", artistId: "a", year: 1 } as any);

      expect(await repo.findOneOrFail({ id: "row_1" } as any)).toMatchObject({
        id: "row_1",
      });
      // The real contract: ProteusRepositoryError `Entity "X" not found`
      // (code `entity_not_found`) — assert the message, not just any throw.
      await expect(repo.findOneOrFail({ id: "nope" } as any)).rejects.toThrow(
        /not found/,
      );
    });

    test("clear empties the store", async () => {
      const repo = await createMockRepository(Album);
      await repo.insert([
        { id: "row_1", artistId: "a", year: 1 },
        { id: "row_2", artistId: "b", year: 2 },
      ] as any);

      await repo.clear();
      expect(await repo.count()).toBe(0);
    });

    test("write methods remain spies", async () => {
      const repo = await createMockRepository(Album);

      await repo.insert({ artistId: "a", year: 1 } as any);
      expect(repo.insert).toHaveBeenCalledTimes(1);
      expect(vi.isMockFunction(repo.insert)).toBe(true);
    });
  });

  describe("fidelity — generated fields are minted like the real driver", () => {
    test("insert mints a non-PK @Generated handle, version, and dates", async () => {
      const repo = await createMockRepository(SessionEntity);

      const before = Date.now();
      const inserted = await repo.insert({ name: "hello" } as any);

      // Primary key + non-PK lindorm_id handle both minted client-side.
      expect(inserted.id).toEqual(expect.any(String));
      expect(inserted.sessionId).toEqual(expect.any(String));

      // The whole point of this entity is the NON-PK generated handle: it must be
      // minted independently of the uuid PK, not aliased to it.
      expect(inserted.sessionId).not.toBe(inserted.id);

      // Persisted generation: first version + create/update dates.
      expect(inserted.version).toBe(1);
      expect(inserted.createdAt).toBeInstanceOf(Date);
      expect(inserted.updatedAt).toBeInstanceOf(Date);
      expect(inserted.createdAt.getTime()).toBeGreaterThanOrEqual(before);

      const found = await repo.findOne({ id: inserted.id } as any);
      expect(found).toMatchObject({
        id: inserted.id,
        sessionId: inserted.sessionId,
        name: "hello",
        version: 1,
      });
    });

    test("create mints client-side identity fields but not version/dates", async () => {
      const repo = await createMockRepository(SessionEntity);

      // create() is SYNC and delegates directly to the real repo — the source is
      // already connected and set up, so no priming call is needed.
      const created = repo.create({ name: "x" } as any);
      expect(created.id).toEqual(expect.any(String));
      expect(created.sessionId).toEqual(expect.any(String));
      // Version and dates are minted at INSERT time, not by create() — create
      // leaves the version field null.
      expect(created.version).toBeNull();
    });
  });
});
