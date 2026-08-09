import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  Cascade,
  CreateDateField,
  Entity,
  Field,
  Generated,
  JoinTable,
  ManyToMany,
  ManyToOne,
  Nullable,
  OneToMany,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../../../decorators/index.js";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import type { IProteusRepository } from "../../../../interfaces/index.js";

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity({ name: "IncTag" })
class IncTag {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  label!: string;

  @ManyToMany(() => IncBook, "tags")
  books!: Array<IncBook>;
}

@Entity({ name: "IncBook" })
class IncBook {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  title!: string;

  @ManyToOne(() => IncAuthor, "books")
  author!: IncAuthor | null;

  @Nullable()
  @Field("uuid")
  authorId!: string | null;

  @Cascade({ onInsert: "cascade", onUpdate: "cascade" })
  @JoinTable()
  @ManyToMany(() => IncTag, "books")
  tags!: Array<IncTag>;
}

@Entity({ name: "IncAuthor" })
class IncAuthor {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @OneToMany(() => IncBook, "author")
  books!: Array<IncBook>;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let authors: IProteusRepository<IncAuthor>;
let books: IProteusRepository<IncBook>;
let tags: IProteusRepository<IncTag>;

let written: IncAuthor;
let unwritten: IncAuthor;
let tagged: IncBook;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [IncAuthor, IncBook, IncTag],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  authors = source.repository(IncAuthor);
  books = source.repository(IncBook);
  tags = source.repository(IncTag);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await books.clear();
  await tags.clear();
  await authors.clear();

  written = await authors.insert({ name: "Written" });
  unwritten = await authors.insert({ name: "Unwritten" });

  const tag = await tags.insert({ label: "epic" });
  tagged = await books.save({ title: "Tagged", authorId: written.id, tags: [tag] });
  await books.insert({ title: "Untagged", authorId: written.id });
  await books.insert({ title: "Orphan", authorId: null });
});

// ─── Strategy ─────────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.include — strategy", () => {
  // There are no round trips in memory, so "join" and "query" describe the same
  // work. Both must land on the same entities.
  test.each(["join", "query"] as const)(
    "%s loads a to-many relation",
    async (strategy) => {
      const found = await source
        .queryBuilder(IncAuthor)
        .include("books", { strategy })
        .where({ id: written.id })
        .getOne();

      expect(found!.books.map((b) => b.title).sort()).toEqual(["Tagged", "Untagged"]);
    },
  );

  test.each(["join", "query"] as const)(
    "%s loads a to-one relation",
    async (strategy) => {
      const found = await source
        .queryBuilder(IncBook)
        .include("author", { strategy })
        .where({ title: "Tagged" })
        .getOne();

      expect(found!.author!.name).toBe("Written");
    },
  );

  test.each(["join", "query"] as const)(
    "%s loads a ManyToMany relation from the owning side",
    async (strategy) => {
      const found = await source
        .queryBuilder(IncBook)
        .include("tags", { strategy })
        .where({ id: tagged.id })
        .getOne();

      expect(found!.tags.map((t) => t.label)).toEqual(["epic"]);
    },
  );

  test.each(["join", "query"] as const)(
    "%s loads a ManyToMany relation from the inverse side",
    async (strategy) => {
      const found = await source
        .queryBuilder(IncTag)
        .include("books", { strategy })
        .where({ label: "epic" })
        .getOne();

      expect(found!.books.map((b) => b.title)).toEqual(["Tagged"]);
    },
  );
});

// ─── Empty relations ──────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.include — empty relations", () => {
  test("an unmatched to-many relation is an empty array", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books")
      .where({ id: unwritten.id })
      .getOne();

    expect(found!.books).toEqual([]);
  });

  test("an unmatched to-one relation is null", async () => {
    const found = await source
      .queryBuilder(IncBook)
      .include("author")
      .where({ title: "Orphan" })
      .getOne();

    expect(found!.author).toBeNull();
  });

  test("an unmatched ManyToMany relation is an empty array", async () => {
    const found = await source
      .queryBuilder(IncBook)
      .include("tags")
      .where({ title: "Untagged" })
      .getOne();

    expect(found!.tags).toEqual([]);
  });
});

// ─── required ─────────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.include — required", () => {
  test("excludes a root with no matching relation", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books", { required: true })
      .getMany();

    expect(found.map((a) => a.name)).toEqual(["Written"]);
  });

  test("excludes a root whose relation the include where emptied", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books", { required: true, where: { title: "no such title" } })
      .getMany();

    expect(found).toEqual([]);
  });

  test("count and exists see the same exclusion", async () => {
    const qb = () => source.queryBuilder(IncAuthor).include("books", { required: true });

    expect(await qb().count()).toBe(1);
    expect(await qb().exists()).toBe(true);
  });

  test("take applies to the roots that survived the exclusion", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books", { required: true })
      .orderBy({ name: "ASC" })
      .take(2)
      .getMany();

    expect(found.map((a) => a.name)).toEqual(["Written"]);
  });
});

// ─── where ────────────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.include — where", () => {
  test("filters the relation, not the root", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books", { where: { title: "Tagged" } })
      .where({ id: written.id })
      .getOne();

    expect(found!.books.map((b) => b.title)).toEqual(["Tagged"]);
  });

  test("a relation filtered to nothing keeps the root with an empty relation", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books", { where: { title: "no such title" } })
      .where({ id: written.id })
      .getOne();

    expect(found).not.toBeNull();
    expect(found!.books).toEqual([]);
  });
});

// ─── select ───────────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.include — select", () => {
  test("limits the related entity to the named columns", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books", { select: ["id", "title", "authorId"] })
      .where({ id: written.id })
      .getOne();

    const book = found!.books.find((b) => b.title === "Tagged")!;
    expect(book.id).toBeDefined();
    expect(book.authorId).toBe(written.id);
    expect(book.createdAt).toBeUndefined();
    expect(book.version).toBeUndefined();
  });

  test("a projected-away join key narrows the columns, not the relation", async () => {
    const found = await source
      .queryBuilder(IncAuthor)
      .include("books", { select: ["title"] })
      .where({ id: written.id })
      .getOne();

    expect(found!.books.map((b) => b.title).sort()).toEqual(["Tagged", "Untagged"]);
    expect(found!.books[0].id).toBeUndefined();
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.include — validation", () => {
  test("rejects an undeclared relation", () => {
    const qb = source.queryBuilder(IncAuthor);
    expect(() => qb.include("nope")).toThrow(/Unknown relation/);
  });

  test("rejects a nested relation path", () => {
    const qb = source.queryBuilder(IncAuthor);
    expect(() => qb.include("books.author")).toThrow(/Unknown relation/);
  });

  test("rejects the same relation twice", () => {
    const qb = source.queryBuilder(IncAuthor).include("books");
    expect(() => qb.include("books")).toThrow(/already included/);
  });
});
