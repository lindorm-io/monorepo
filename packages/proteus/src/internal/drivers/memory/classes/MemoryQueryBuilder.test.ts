import { createMockLogger } from "@lindorm/logger";
import {
  CreateDateField,
  DeleteDateField,
  Entity,
  Field,
  Nullable,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "../../../../decorators";
import { ProteusSource } from "../../../../classes/ProteusSource";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import type { IProteusRepository } from "../../../../interfaces";

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity({ name: "QbTestProduct" })
class QbTestProduct {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("integer")
  price!: number | null;

  @Field("string")
  category!: string;
}

@Entity({ name: "QbSoftDeleteProduct" })
class QbSoftDeleteProduct {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @DeleteDateField()
  deletedAt!: Date | null;

  @Field("string")
  name!: string;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let repo: IProteusRepository<QbTestProduct>;
let softRepo: IProteusRepository<QbSoftDeleteProduct>;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [QbTestProduct, QbSoftDeleteProduct],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  repo = source.repository(QbTestProduct);
  softRepo = source.repository(QbSoftDeleteProduct);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await repo.clear();
  await softRepo.clear();
});

// ─── Not-supported raw methods ────────────────────────────────────────────────

describe("MemoryQueryBuilder — unsupported methods", () => {
  const unsupportedMethods = [
    "whereRaw",
    "andWhereRaw",
    "orWhereRaw",
    "selectRaw",
    "groupBy",
    "having",
    "andHaving",
    "orHaving",
    "havingRaw",
    "andHavingRaw",
    "orHavingRaw",
    "window",
  ] as const;

  for (const method of unsupportedMethods) {
    test(`${method}() throws NotSupportedError`, () => {
      const qb = source.queryBuilder(QbTestProduct);
      expect(() => (qb as any)[method]()).toThrow(NotSupportedError);
    });
  }
});

// ─── toQuery / clone ──────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.toQuery / clone", () => {
  test("toQuery returns state and driver identifier", () => {
    const qb = source.queryBuilder(QbTestProduct);
    const query = qb.toQuery();
    expect(query).toMatchSnapshot();
  });

  test("clone produces independent copy with same state", async () => {
    await repo.insert(repo.create({ name: "A", price: 10, category: "x" }));
    await repo.insert(repo.create({ name: "B", price: 20, category: "x" }));

    const qb = source.queryBuilder(QbTestProduct).where({ category: "x" });
    const cloned = qb.clone();

    const original = await qb.getMany();
    const clonedResult = await cloned.getMany();

    expect(original).toHaveLength(2);
    expect(clonedResult).toHaveLength(2);
  });
});

// ─── getOne / getOneOrFail ────────────────────────────────────────────────────

describe("MemoryQueryBuilder.getOne / getOneOrFail", () => {
  test("getOne returns matching entity", async () => {
    await repo.insert(repo.create({ name: "Alpha", price: 5, category: "electronics" }));

    const result = await source
      .queryBuilder(QbTestProduct)
      .where({ name: "Alpha" })
      .getOne();

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Alpha");
  });

  test("getOne returns null when no match", async () => {
    const result = await source
      .queryBuilder(QbTestProduct)
      .where({ name: "NonExistent" })
      .getOne();

    expect(result).toBeNull();
  });

  test("getOneOrFail returns entity when found", async () => {
    await repo.insert(repo.create({ name: "Found", price: 1, category: "books" }));

    const result = await source
      .queryBuilder(QbTestProduct)
      .where({ name: "Found" })
      .getOneOrFail();

    expect(result.name).toBe("Found");
  });

  test("getOneOrFail throws ProteusRepositoryError when not found", async () => {
    await expect(
      source.queryBuilder(QbTestProduct).where({ name: "Missing" }).getOneOrFail(),
    ).rejects.toThrow(ProteusRepositoryError);
  });
});

// ─── getMany ──────────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.getMany", () => {
  beforeEach(async () => {
    await repo.insert(repo.create({ name: "A", price: 10, category: "books" }));
    await repo.insert(repo.create({ name: "B", price: 20, category: "electronics" }));
    await repo.insert(repo.create({ name: "C", price: 30, category: "books" }));
  });

  test("returns all rows without a where clause", async () => {
    const results = await source.queryBuilder(QbTestProduct).getMany();
    expect(results).toHaveLength(3);
  });

  test("filters by where predicate", async () => {
    const results = await source
      .queryBuilder(QbTestProduct)
      .where({ category: "books" })
      .getMany();
    expect(results).toHaveLength(2);
  });

  test("supports orderBy ASC", async () => {
    const results = await source
      .queryBuilder(QbTestProduct)
      .orderBy({ price: "ASC" })
      .getMany();

    const prices = results.map((r) => r.price);
    expect(prices).toEqual([10, 20, 30]);
  });

  test("supports orderBy DESC", async () => {
    const results = await source
      .queryBuilder(QbTestProduct)
      .orderBy({ price: "DESC" })
      .getMany();

    const prices = results.map((r) => r.price);
    expect(prices).toEqual([30, 20, 10]);
  });

  test("applies skip and take for pagination", async () => {
    const results = await source
      .queryBuilder(QbTestProduct)
      .orderBy({ name: "ASC" })
      .skip(1)
      .take(1)
      .getMany();

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("B");
  });

  test("select projects only requested fields", async () => {
    const results = await source.queryBuilder(QbTestProduct).select("name").getMany();

    expect(results[0]).toMatchSnapshot();
  });
});

// ─── getManyAndCount ──────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.getManyAndCount", () => {
  beforeEach(async () => {
    for (let i = 0; i < 5; i++) {
      await repo.insert(
        repo.create({ name: `Item ${i}`, price: i * 10, category: "misc" }),
      );
    }
  });

  test("returns paginated results and total count", async () => {
    const [entities, total] = await source
      .queryBuilder(QbTestProduct)
      .skip(1)
      .take(2)
      .getManyAndCount();

    expect(total).toBe(5);
    expect(entities).toHaveLength(2);
  });

  test("total count ignores pagination", async () => {
    const [, total] = await source.queryBuilder(QbTestProduct).take(1).getManyAndCount();

    expect(total).toBe(5);
  });
});

// ─── count / exists ───────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.count / exists", () => {
  beforeEach(async () => {
    await repo.insert(repo.create({ name: "X", price: 1, category: "cat" }));
    await repo.insert(repo.create({ name: "Y", price: 2, category: "cat" }));
  });

  test("count returns total number of matching rows", async () => {
    const count = await source.queryBuilder(QbTestProduct).count();
    expect(count).toBe(2);
  });

  test("count with where predicate", async () => {
    const count = await source.queryBuilder(QbTestProduct).where({ name: "X" }).count();

    expect(count).toBe(1);
  });

  test("exists returns true when rows exist", async () => {
    const result = await source.queryBuilder(QbTestProduct).exists();
    expect(result).toBe(true);
  });

  test("exists returns false when no rows match", async () => {
    const result = await source
      .queryBuilder(QbTestProduct)
      .where({ name: "NotHere" })
      .exists();

    expect(result).toBe(false);
  });
});

// ─── Aggregates ───────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder aggregates", () => {
  beforeEach(async () => {
    await repo.insert(repo.create({ name: "A", price: 10, category: "agg" }));
    await repo.insert(repo.create({ name: "B", price: 20, category: "agg" }));
    await repo.insert(repo.create({ name: "C", price: 30, category: "agg" }));
  });

  test("sum returns total of field values", async () => {
    const result = await source.queryBuilder(QbTestProduct).sum("price");
    expect(result).toBe(60);
  });

  test("average returns mean of field values", async () => {
    const result = await source.queryBuilder(QbTestProduct).average("price");
    expect(result).toBe(20);
  });

  test("minimum returns lowest value", async () => {
    const result = await source.queryBuilder(QbTestProduct).minimum("price");
    expect(result).toBe(10);
  });

  test("maximum returns highest value", async () => {
    const result = await source.queryBuilder(QbTestProduct).maximum("price");
    expect(result).toBe(30);
  });

  test("aggregates return null for empty result set", async () => {
    await repo.clear();
    expect(await source.queryBuilder(QbTestProduct).sum("price")).toBeNull();
    expect(await source.queryBuilder(QbTestProduct).average("price")).toBeNull();
    expect(await source.queryBuilder(QbTestProduct).minimum("price")).toBeNull();
    expect(await source.queryBuilder(QbTestProduct).maximum("price")).toBeNull();
  });

  test("sum ignores null values", async () => {
    await repo.clear();
    await repo.insert(repo.create({ name: "WithNull", price: null, category: "agg" }));
    await repo.insert(repo.create({ name: "WithValue", price: 50, category: "agg" }));

    const result = await source.queryBuilder(QbTestProduct).sum("price");
    expect(result).toBe(50);
  });
});

// ─── insert / update / delete builders ───────────────────────────────────────

describe("MemoryQueryBuilder write builders", () => {
  test("insert().values().execute() inserts rows", async () => {
    const qb = source.queryBuilder(QbTestProduct);
    const result = await qb
      .insert()
      .values([
        {
          id: "manual-1",
          name: "Manual A",
          price: 5,
          category: "test",
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])
      .execute();

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].name).toBe("Manual A");
  });

  test("update().set().where().execute() updates matching rows", async () => {
    await repo.insert(repo.create({ name: "BeforeUpdate", price: 10, category: "upd" }));

    const qb = source.queryBuilder(QbTestProduct);
    const result = await qb
      .update()
      .set({ price: 99 } as any)
      .where({ name: "BeforeUpdate" })
      .execute();

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].price).toBe(99);
  });

  test("delete().where().execute() deletes matching rows", async () => {
    await repo.insert(repo.create({ name: "ToDelete", price: 1, category: "del" }));

    const qb = source.queryBuilder(QbTestProduct);
    await qb.delete().where({ name: "ToDelete" }).execute();

    const remaining = await source.queryBuilder(QbTestProduct).getMany();
    expect(remaining).toHaveLength(0);
  });

  test("softDelete().where().execute() sets deletedAt instead of removing", async () => {
    await softRepo.insert(softRepo.create({ name: "ToSoftDelete" }));

    const qb = source.queryBuilder(QbSoftDeleteProduct);
    const result = await qb.softDelete().where({ name: "ToSoftDelete" }).execute();

    expect(result.rowCount).toBe(1);

    // Row should no longer appear in default query (filtered by __softDelete)
    const remaining = await source.queryBuilder(QbSoftDeleteProduct).getMany();
    expect(remaining).toHaveLength(0);

    // But visible with withDeleted
    const withDeleted = await source
      .queryBuilder(QbSoftDeleteProduct)
      .withDeleted()
      .getMany();
    expect(withDeleted).toHaveLength(1);
    expect(withDeleted[0].deletedAt).toBeInstanceOf(Date);
  });
});

// ─── distinct ─────────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.distinct", () => {
  test("distinct removes duplicate rows", async () => {
    await repo.insert(repo.create({ name: "Dup", price: 10, category: "dup" }));
    await repo.insert(repo.create({ name: "Dup", price: 10, category: "dup" }));
    await repo.insert(repo.create({ name: "Unique", price: 20, category: "dup" }));

    const results = await source
      .queryBuilder(QbTestProduct)
      .select("name", "price")
      .distinct()
      .getMany();

    // Distinct on selected fields: name+price "Dup"/"10" should appear once
    const dupRows = results.filter((r) => r.name === "Dup");
    expect(dupRows).toHaveLength(1);
  });
});

// ─── getRawRows ───────────────────────────────────────────────────────────────

describe("MemoryQueryBuilder.getRawRows", () => {
  test("returns raw row dictionaries", async () => {
    await repo.insert(repo.create({ name: "RawTest", price: 7, category: "raw" }));

    const rows = await source.queryBuilder(QbTestProduct).getRawRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty("name", "RawTest");
  });
});
