// A non-nullable @Field("array") without @Nullable and without an explicit
// @Default zero-coerces to an empty array — mirroring how a non-nullable boolean
// coerces to `false`. This exercises the full memory-driver round-trip: an
// insert omitting the array persists and reads back as [], never null.

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import {
  Default,
  Entity,
  Field,
  Generated,
  Nullable,
  PrimaryKeyField,
} from "../../decorators/index.js";
import { ProteusSource } from "../../classes/ProteusSource.js";
import type { IProteusRepository } from "../../interfaces/index.js";

@Entity({ name: "ArrayDefaultDoc" })
class ArrayDefaultDoc {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;

  @Field("array")
  tags!: Array<string>;

  @Nullable()
  @Field("array")
  labels!: Array<string> | null;

  @Default(() => ["seed"])
  @Field("array")
  seeded!: Array<string>;

  @Field("array", { arrayType: "timestamp" })
  timestamps!: Array<Date>;

  @Field("object")
  meta!: Record<string, unknown>;

  @Nullable()
  @Field("object")
  settings!: Record<string, unknown> | null;
}

let source: ProteusSource;
let repo: IProteusRepository<ArrayDefaultDoc>;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [ArrayDefaultDoc],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();
  repo = source.repository(ArrayDefaultDoc);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await repo.clear();
});

describe("memory driver — non-nullable array default", () => {
  test("insert omitting the array persists and reads back as []", async () => {
    const inserted = await repo.insert({ name: "no-tags" });
    expect(inserted.tags).toEqual([]);

    const found = await repo.findOne({ id: inserted.id });
    expect(found!.tags).toEqual([]);
  });

  test("an omitted @Nullable array stays null", async () => {
    const inserted = await repo.insert({ name: "nullable" });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.labels).toBeNull();
  });

  test("an explicit @Default wins over the empty-array zero-value", async () => {
    const inserted = await repo.insert({ name: "seeded" });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.seeded).toEqual(["seed"]);
  });

  test("an explicit empty array round-trips", async () => {
    const inserted = await repo.insert({ name: "empty", tags: [] });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.tags).toEqual([]);
  });

  test("a populated array round-trips unchanged", async () => {
    const inserted = await repo.insert({ name: "populated", tags: ["a", "b"] });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.tags).toEqual(["a", "b"]);
  });

  test("two inserts omitting the array hold distinct array instances", async () => {
    const a = await repo.insert({ name: "a" });
    const b = await repo.insert({ name: "b" });

    a.tags.push("mutated");

    expect(a.tags).toEqual(["mutated"]);
    expect(b.tags).toEqual([]);
  });

  test("a typed array deserialises its elements on read", async () => {
    const when = new Date("2026-01-15T00:00:00.000Z");
    const inserted = await repo.insert({ name: "typed", timestamps: [when] });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.timestamps).toHaveLength(1);
    expect(found!.timestamps[0]).toBeInstanceOf(Date);
    expect(found!.timestamps[0].toISOString()).toBe(when.toISOString());
  });

  test("an omitted typed array reads back as []", async () => {
    const inserted = await repo.insert({ name: "no-timestamps" });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.timestamps).toEqual([]);
  });

  test("insert omitting a non-nullable object persists and reads back as {}", async () => {
    const inserted = await repo.insert({ name: "no-meta" });
    expect(inserted.meta).toEqual({});

    const found = await repo.findOne({ id: inserted.id });
    expect(found!.meta).toEqual({});
  });

  test("an omitted @Nullable object stays null", async () => {
    const inserted = await repo.insert({ name: "nullable-object" });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.settings).toBeNull();
  });

  test("a populated object round-trips unchanged", async () => {
    const inserted = await repo.insert({ name: "populated-object", meta: { a: 1 } });
    const found = await repo.findOne({ id: inserted.id });
    expect(found!.meta).toEqual({ a: 1 });
  });
});
