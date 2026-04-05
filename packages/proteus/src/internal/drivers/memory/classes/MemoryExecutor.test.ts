// Unit tests for MemoryExecutor — focused on null sort ordering (FIX-3)
// and filter registry wiring.

import { createMockLogger } from "@lindorm/logger";
import {
  CreateDateField,
  DeleteDateField,
  Entity,
  Field,
  Filter,
  Nullable,
  PrimaryKeyField,
  ScopeField,
  UpdateDateField,
  VersionField,
} from "../../../../decorators";
import { ProteusSource } from "../../../../classes/ProteusSource";
import type { IProteusRepository } from "../../../../interfaces";

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity({ name: "NullSortEntity" })
class NullSortEntity {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Nullable()
  @Field("integer")
  score!: number | null;

  @Field("string")
  label!: string;
}

@Entity({ name: "FilteredEntity" })
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
class FilteredEntity {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  tenantId!: string;

  @Field("string")
  label!: string;
}

@Entity({ name: "ScopeFilterEntity" })
class ScopeFilterEntity {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @ScopeField()
  scope!: string;

  @Field("string")
  label!: string;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let source: ProteusSource;
let nullSortRepo: IProteusRepository<NullSortEntity>;
let filteredRepo: IProteusRepository<FilteredEntity>;
let scopeRepo: IProteusRepository<ScopeFilterEntity>;

beforeAll(async () => {
  source = new ProteusSource({
    driver: "memory",
    entities: [NullSortEntity, FilteredEntity, ScopeFilterEntity],
    logger: createMockLogger(),
  });
  await source.connect();
  await source.setup();

  nullSortRepo = source.repository(NullSortEntity);
  filteredRepo = source.repository(FilteredEntity);
  scopeRepo = source.repository(ScopeFilterEntity);
});

afterAll(async () => {
  await source.disconnect();
});

beforeEach(async () => {
  await nullSortRepo.clear();
  await filteredRepo.clear();
  await scopeRepo.clear();
});

// ─── FIX-3: Null sort ordering ────────────────────────────────────────────────

describe("MemoryExecutor — null sort ordering (FIX-3)", () => {
  beforeEach(async () => {
    // Seed: mix of null and non-null scores
    await nullSortRepo.insert(nullSortRepo.create({ label: "A", score: 10 }));
    await nullSortRepo.insert(nullSortRepo.create({ label: "B", score: null }));
    await nullSortRepo.insert(nullSortRepo.create({ label: "C", score: 5 }));
    await nullSortRepo.insert(nullSortRepo.create({ label: "D", score: null }));
    await nullSortRepo.insert(nullSortRepo.create({ label: "E", score: 20 }));
  });

  describe("executeFind (find())", () => {
    test("ASC ordering — nulls sort last", async () => {
      const results = await nullSortRepo.find(undefined, { order: { score: "ASC" } });

      // Non-null values come first (ascending), then nulls at the end
      const scores = results.map((r) => r.score);
      const nonNullScores = scores.filter((s) => s !== null) as number[];
      const nullScores = scores.filter((s) => s === null);

      expect(nonNullScores).toEqual([5, 10, 20]);
      expect(nullScores).toHaveLength(2);
      // Nulls must appear after all non-null values
      const lastNonNullIdx = Math.max(
        ...results.map((r, i) => (r.score !== null ? i : -1)),
      );
      const firstNullIdx = results.findIndex((r) => r.score === null);
      expect(firstNullIdx).toBeGreaterThan(lastNonNullIdx);
    });

    test("DESC ordering — nulls sort first", async () => {
      const results = await nullSortRepo.find(undefined, { order: { score: "DESC" } });

      const scores = results.map((r) => r.score);
      const nonNullScores = scores.filter((s) => s !== null) as number[];
      const nullScores = scores.filter((s) => s === null);

      expect(nonNullScores).toEqual([20, 10, 5]);
      expect(nullScores).toHaveLength(2);
      // Nulls must appear before all non-null values
      const firstNonNullIdx = results.findIndex((r) => r.score !== null);
      const lastNullIdx = Math.max(...results.map((r, i) => (r.score === null ? i : -1)));
      expect(lastNullIdx).toBeLessThan(firstNonNullIdx);
    });

    test("ordering by non-nullable field is unaffected when nulls exist in other fields", async () => {
      const results = await nullSortRepo.find(undefined, { order: { label: "ASC" } });
      const labels = results.map((r) => r.label);
      expect(labels).toEqual(["A", "B", "C", "D", "E"]);
    });
  });

  describe("MemoryQueryBuilder.resolveRows (getMany())", () => {
    test("ASC orderBy via QB — nulls sort last", async () => {
      const qb = source.queryBuilder(NullSortEntity);
      const results = await qb.orderBy({ score: "ASC" }).getMany();

      const scores = results.map((r) => r.score);
      const nonNullScores = scores.filter((s) => s !== null) as number[];

      expect(nonNullScores).toEqual([5, 10, 20]);

      // Verify all nulls are at the tail
      const firstNullIdx = scores.findIndex((s) => s === null);
      expect(firstNullIdx).toBeGreaterThanOrEqual(nonNullScores.length);
    });

    test("DESC orderBy via QB — nulls sort first", async () => {
      const qb = source.queryBuilder(NullSortEntity);
      const results = await qb.orderBy({ score: "DESC" }).getMany();

      const scores = results.map((r) => r.score);
      const nonNullScores = scores.filter((s) => s !== null) as number[];

      expect(nonNullScores).toEqual([20, 10, 5]);

      // All nulls are at the head
      const lastNullIdx = Math.max(...scores.map((s, i) => (s === null ? i : -1)));
      const firstNonNullIdx = scores.findIndex((s) => s !== null);
      expect(lastNullIdx).toBeLessThan(firstNonNullIdx);
    });
  });
});

// ─── Filter registry wiring (FIX-5 context) ──────────────────────────────────
//
// Source-level filters are applied by MemoryExecutor (used by repository()).
// MemoryQueryBuilder uses state.filterOverrides instead (per-query via setFilter()).

describe("MemoryExecutor — filter registry wiring (repository path)", () => {
  beforeEach(async () => {
    await filteredRepo.insert(filteredRepo.create({ tenantId: "tenant-a", label: "A1" }));
    await filteredRepo.insert(filteredRepo.create({ tenantId: "tenant-a", label: "A2" }));
    await filteredRepo.insert(filteredRepo.create({ tenantId: "tenant-b", label: "B1" }));
  });

  test("no filter active — find() returns all rows", async () => {
    const results = await filteredRepo.find();
    expect(results).toHaveLength(3);
  });

  test("source-level filter enabled — repository find() returns only matching rows", async () => {
    const tenantSource = source.session();
    tenantSource.setFilterParams("tenant", { tenantId: "tenant-a" });
    tenantSource.enableFilter("tenant");

    const repo = tenantSource.repository(FilteredEntity);
    const results = await repo.find();

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.tenantId).toBe("tenant-a");
    }
  });

  test("source-level filter isolation — original source unaffected by session filter", async () => {
    const tenantSource = source.session();
    tenantSource.setFilterParams("tenant", { tenantId: "tenant-b" });
    tenantSource.enableFilter("tenant");

    // Clone repository sees only tenant-b
    const cloneResults = await tenantSource.repository(FilteredEntity).find();
    expect(cloneResults).toHaveLength(1);
    expect(cloneResults[0].label).toBe("B1");

    // Original repository still sees all
    const originalResults = await filteredRepo.find();
    expect(originalResults).toHaveLength(3);
  });
});

// ─── Scope filter + withoutScope wiring (FIX-7 context) ──────────────────────

describe("MemoryExecutor — withoutScope", () => {
  beforeEach(async () => {
    await scopeRepo.insert(scopeRepo.create({ scope: "tenant-a", label: "A1" }));
    await scopeRepo.insert(scopeRepo.create({ scope: "tenant-a", label: "A2" }));
    await scopeRepo.insert(scopeRepo.create({ scope: "tenant-b", label: "B1" }));
  });

  test("find with withoutScope: true returns all scopes", async () => {
    // The __scope filter only activates when scope params are configured.
    // Without any scope params the filter is silently inactive, so withoutScope
    // is mainly tested as 'does not throw and returns all rows'.
    const results = await scopeRepo.find(undefined, { withoutScope: true });
    expect(results).toHaveLength(3);
  });

  test("QB withoutScope() passes through to filter resolution", async () => {
    const results = await source.queryBuilder(ScopeFilterEntity).withoutScope().getMany();

    // Again: with no scope params configured the filter is inactive anyway,
    // but withoutScope() must not break the query.
    expect(results).toHaveLength(3);
  });
});
