import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { isBigInt } from "@lindorm/is";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  Entity,
  Field,
  Generated,
  ManyToOne,
  OneToMany,
  PrimaryKey,
} from "../../../../decorators/index.js";
import { ProteusSource } from "../../../../classes/ProteusSource.js";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError.js";
import type { IProteusRepository } from "../../../../interfaces/index.js";

// ─── Entities ─────────────────────────────────────────────────────────────────
//
// Real consumers use `@Generated("increment") @Field("bigint")` primary keys.
// The memory-driver tests previously only ever exercised string/uuid PKs, so a
// bigint-PK regression (number-minted auto-increment + a JSON.stringify PK crash)
// shipped unnoticed. These entities reproduce that shape: a parent → child FK
// relationship where BOTH sides carry a bigint auto-increment PK, and the child's
// FK column references the parent's bigint PK.

@Entity({ name: "BigIntPkParent" })
class BigIntPkParent {
  @PrimaryKey() @Generated("increment") @Field("bigint") id!: bigint;

  @Field("string")
  name!: string;

  @OneToMany(() => BigIntPkChild, "parent")
  children!: Array<BigIntPkChild>;
}

@Entity({ name: "BigIntPkChild" })
class BigIntPkChild {
  @PrimaryKey() @Generated("increment") @Field("bigint") id!: bigint;

  @Field("string")
  label!: string;

  @ManyToOne(() => BigIntPkParent, "children")
  parent!: BigIntPkParent | null;

  // Owning-side FK column (join key `parentId` → BigIntPkParent.id). Holds the
  // parent's bigint PK value; the memory driver extracts it from the relation's
  // joinKeys during dehydrate.
  parentId!: bigint;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
//
// A FRESH source per test: MemoryRepository.clear() does NOT reset the driver's
// auto-increment counters, so a new source is the only way to guarantee the
// counter starts at 0 and the minted ids are deterministically 1n, 2n, …

let source: ProteusSource;
let parentRepo: IProteusRepository<BigIntPkParent>;
let childRepo: IProteusRepository<BigIntPkChild>;

beforeEach(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [BigIntPkParent, BigIntPkChild],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  parentRepo = source.repository(BigIntPkParent);
  childRepo = source.repository(BigIntPkChild);
});

afterEach(async () => {
  await source.disconnect();
});

// ─── 1. auto-increment mints a bigint ───────────────────────────────────────────

describe("bigint auto-increment", () => {
  test("mints a JS bigint (not a number) for a @Field('bigint') increment PK", async () => {
    const inserted = await parentRepo.insert(parentRepo.create({ name: "first" }));

    expect(isBigInt(inserted.id)).toBe(true);
    expect(inserted.id).toBe(1n);
    expect(inserted).toMatchSnapshot();
  });

  test("assigns sequential bigint ids across successive inserts", async () => {
    const a = await parentRepo.insert(parentRepo.create({ name: "a" }));
    const b = await parentRepo.insert(parentRepo.create({ name: "b" }));
    const c = await parentRepo.insert(parentRepo.create({ name: "c" }));

    expect([a.id, b.id, c.id]).toEqual([1n, 2n, 3n]);
    expect([isBigInt(a.id), isBigInt(b.id), isBigInt(c.id)]).toEqual([true, true, true]);
  });

  test("counters are independent per entity", async () => {
    const parent = await parentRepo.insert(parentRepo.create({ name: "p" }));
    const child = await childRepo.insert(
      childRepo.create({ label: "c", parentId: parent.id }),
    );

    expect(parent.id).toBe(1n);
    expect(child.id).toBe(1n);
  });
});

// ─── 2. read by bigint id ────────────────────────────────────────────────────────

describe("bigint read paths", () => {
  test("findOne matches a stored row by its bigint id (strict === on both sides)", async () => {
    const inserted = await parentRepo.insert(parentRepo.create({ name: "findable" }));

    const found = await parentRepo.findOne({ id: inserted.id });

    expect(found).not.toBeNull();
    expect(found!.id).toBe(1n);
    expect(found!.name).toBe("findable");
    expect(found).toMatchSnapshot();
  });

  test("findOne returns null for a non-existent bigint id", async () => {
    await parentRepo.insert(parentRepo.create({ name: "only" }));

    const found = await parentRepo.findOne({ id: 999n });

    expect(found).toBeNull();
  });

  test("find and count filter by a bigint criterion", async () => {
    const a = await parentRepo.insert(parentRepo.create({ name: "a" }));
    await parentRepo.insert(parentRepo.create({ name: "b" }));

    const found = await parentRepo.find({ id: a.id });
    const count = await parentRepo.count({ id: a.id });

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(1n);
    expect(count).toBe(1);
  });
});

// ─── 3. cross-table bigint FK integrity ─────────────────────────────────────────

describe("bigint foreign-key integrity", () => {
  test("a child whose FK equals an existing parent's bigint id inserts cleanly", async () => {
    const parent = await parentRepo.insert(parentRepo.create({ name: "parent" }));

    const child = await childRepo.insert(
      childRepo.create({ label: "child", parentId: parent.id }),
    );

    expect(child.parentId).toBe(parent.id);
    expect(isBigInt(child.parentId)).toBe(true);

    // Round-trips through storage — the FK value survives as a bigint.
    const found = await childRepo.findOne({ id: child.id });
    expect(found!.parentId).toBe(parent.id);
  });

  test("a child with a non-existent bigint FK is rejected", async () => {
    await parentRepo.insert(parentRepo.create({ name: "parent" }));

    await expect(
      childRepo.insert(childRepo.create({ label: "orphan", parentId: 424242n })),
    ).rejects.toThrow(ForeignKeyViolationError);
  });
});

// ─── 4. update / save / destroy on a bigint-PK entity ───────────────────────────

describe("bigint-PK write operations (serializePk must be bigint-safe)", () => {
  test("update() persists a field change without crashing", async () => {
    const inserted = await parentRepo.insert(parentRepo.create({ name: "before" }));

    inserted.name = "after";
    const updated = await parentRepo.update(inserted);

    expect(updated.name).toBe("after");

    const found = await parentRepo.findOne({ id: inserted.id });
    expect(found!.name).toBe("after");
  });

  test("save() on an existing bigint-PK entity updates in place", async () => {
    const inserted = await parentRepo.insert(parentRepo.create({ name: "orig" }));

    inserted.name = "saved";
    const saved = await parentRepo.save(inserted);

    expect(saved.name).toBe("saved");

    const all = await parentRepo.find({ id: inserted.id });
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("saved");
  });

  test("destroy() removes a bigint-PK row", async () => {
    const inserted = await parentRepo.insert(parentRepo.create({ name: "gone" }));

    await parentRepo.destroy(inserted);

    const found = await parentRepo.findOne({ id: inserted.id });
    expect(found).toBeNull();
  });
});

// ─── 5. explicit bigint-id insert ────────────────────────────────────────────────

describe("explicit bigint-id insert", () => {
  test("an explicit id: 5n round-trips and suppresses auto-increment", async () => {
    const entity = parentRepo.create({ name: "explicit" });
    entity.id = 5n;

    const inserted = await parentRepo.insert(entity);
    expect(inserted.id).toBe(5n);

    const found = await parentRepo.findOne({ id: 5n });
    expect(found).not.toBeNull();
    expect(found!.id).toBe(5n);
    expect(found!.name).toBe("explicit");

    // The auto-increment counter is untouched by the explicit insert: the next
    // generated id is still 1n.
    const generated = await parentRepo.insert(parentRepo.create({ name: "auto" }));
    expect(generated.id).toBe(1n);
  });

  test("uniqueness still holds for a duplicate explicit bigint id", async () => {
    const first = parentRepo.create({ name: "one" });
    first.id = 5n;
    await parentRepo.insert(first);

    const dup = parentRepo.create({ name: "two" });
    dup.id = 5n;

    await expect(parentRepo.insert(dup)).rejects.toThrow(MemoryDuplicateKeyError);
  });
});
