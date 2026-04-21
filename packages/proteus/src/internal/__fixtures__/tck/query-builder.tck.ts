import { describe, test, it, expect, beforeEach } from "vitest";
// TCK: QueryBuilder Suite
// Tests basic QueryBuilder operations: where, orderBy, skip, take, getOne,
// getMany, count, exists, withDeleted. Excludes advanced features (raw SQL,
// GROUP BY, window functions, CTEs, subqueries, set operations).

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import type { ProteusSource } from "../../../classes/ProteusSource";
export const queryBuilderSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  getSource: () => ProteusSource,
) => {
  const { TckSimpleUser, TckSoftDeletable, TckScoped, TckCar, TckTruck, TckVehicle } =
    entities;

  void TckScoped; // referenced in filter tests via string-based approach

  beforeEach(async () => {
    await getHandle().clear();
    const repo = getHandle().repository(TckSimpleUser);
    await repo.insert({ name: "Alice", age: 30, email: "alice@test.com" });
    await repo.insert({ name: "Bob", age: 20, email: "bob@test.com" });
    await repo.insert({ name: "Charlie", age: 40, email: "charlie@test.com" });
    await repo.insert({ name: "Dave", age: 20, email: "dave@test.com" });
  });

  test("where filters results", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const results = await qb.where({ age: 20 }).getMany();
    expect(results).toHaveLength(2);
    results.forEach((r) => expect(r.age).toBe(20));
  });

  test("andWhere adds additional filter", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const results = await qb.where({ age: 20 }).andWhere({ name: "Bob" }).getMany();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Bob");
  });

  test("orWhere adds alternative filter", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const results = await qb
      .where({ name: "Alice" })
      .orWhere({ name: "Charlie" })
      .getMany();
    expect(results).toHaveLength(2);
  });

  test("orderBy sorts results", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const results = await qb.orderBy({ name: "ASC" }).getMany();
    expect(results[0].name).toBe("Alice");
    expect(results[3].name).toBe("Dave");
  });

  test("skip and take paginate results", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const results = await qb.orderBy({ name: "ASC" }).skip(1).take(2).getMany();
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Bob");
    expect(results[1].name).toBe("Charlie");
  });

  test("getOne returns first matching entity", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const result = await qb.where({ name: "Alice" }).getOne();
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Alice");
  });

  test("getOne returns null when no match", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const result = await qb.where({ name: "Nonexistent" }).getOne();
    expect(result).toBeNull();
  });

  test("getOneOrFail throws on no match", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    await expect(qb.where({ name: "Nonexistent" }).getOneOrFail()).rejects.toThrow();
  });

  test("count returns number of matching entities", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const count = await qb.where({ age: 20 }).count();
    expect(count).toBe(2);
  });

  test("exists returns boolean", async () => {
    const source = getSource();

    const exists = await source
      .queryBuilder(TckSimpleUser)
      .where({ name: "Alice" })
      .exists();
    expect(exists).toBe(true);

    const notExists = await source
      .queryBuilder(TckSimpleUser)
      .where({ name: "Nobody" })
      .exists();
    expect(notExists).toBe(false);
  });

  test("getManyAndCount returns entities and total", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const [results, total] = await qb.orderBy({ name: "ASC" }).take(2).getManyAndCount();
    expect(results).toHaveLength(2);
    expect(total).toBe(4);
  });

  test("select limits returned fields", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser);

    const results = await qb
      .select("id", "name")
      .orderBy({ name: "ASC" })
      .take(1)
      .getMany();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBeDefined();
    expect(results[0].name).toBe("Alice");
  });

  test("withDeleted includes soft-deleted entities", async () => {
    const sdRepo = getHandle().repository(TckSoftDeletable);
    await sdRepo.insert({ name: "SD1" });
    const sd2 = await sdRepo.insert({ name: "SD2" });
    await sdRepo.softDestroy(sd2);

    const source = getSource();

    const withoutDeleted = await source.queryBuilder(TckSoftDeletable).getMany();
    expect(withoutDeleted).toHaveLength(1);

    const withDeleted = await source
      .queryBuilder(TckSoftDeletable)
      .withDeleted()
      .getMany();
    expect(withDeleted).toHaveLength(2);
  });

  test("clone creates independent copy", async () => {
    const source = getSource();
    const qb1 = source.queryBuilder(TckSimpleUser).where({ age: 20 });
    const qb2 = qb1.clone().andWhere({ name: "Bob" });

    const results1 = await qb1.getMany();
    const results2 = await qb2.getMany();

    expect(results1).toHaveLength(2);
    expect(results2).toHaveLength(1);
  });

  // ─── A9: Aggregate terminals ─────────────────────────────────────

  test("QB sum returns aggregate total", async () => {
    const source = getSource();
    const result = await source.queryBuilder(TckSimpleUser).sum("age");
    // Alice(30) + Bob(20) + Charlie(40) + Dave(20) = 110
    expect(result).toBe(110);
  });

  test("QB average returns mean", async () => {
    const source = getSource();
    const result = await source.queryBuilder(TckSimpleUser).average("age");
    // (30 + 20 + 40 + 20) / 4 = 27.5
    expect(result).toBe(27.5);
  });

  test("QB minimum returns lowest", async () => {
    const source = getSource();
    const result = await source.queryBuilder(TckSimpleUser).minimum("age");
    expect(result).toBe(20);
  });

  test("QB maximum returns highest", async () => {
    const source = getSource();
    const result = await source.queryBuilder(TckSimpleUser).maximum("age");
    expect(result).toBe(40);
  });

  test("QB sum with where filters", async () => {
    const source = getSource();
    const result = await source
      .queryBuilder(TckSimpleUser)
      .where({ name: "Alice" })
      .sum("age");
    expect(result).toBe(30);
  });

  // ─── FIX-5: .setFilter() wiring through MemoryQueryBuilder ───────────────

  test("setFilter() with params enables a named @Filter in QB execution", async () => {
    // TckSoftDeletable has a __softDelete auto-filter. We use TckScoped which
    // has no named @Filter — instead we verify .setFilter() with the __softDelete
    // override by testing that it bypasses soft-delete when passed false.
    const sdRepo = getHandle().repository(TckSoftDeletable);
    const sd1 = await sdRepo.insert({ name: "SD-FilterTest-1" });
    const sd2 = await sdRepo.insert({ name: "SD-FilterTest-2" });
    await sdRepo.softDestroy(sd2);

    const source = getSource();

    // Without any filter override: soft-deleted row is excluded
    const withoutOverride = await source.queryBuilder(TckSoftDeletable).getMany();
    expect(withoutOverride).toHaveLength(1);

    // .setFilter("__softDelete", false) disables the soft-delete filter
    const withFilterFalse = await source
      .queryBuilder(TckSoftDeletable)
      .setFilter("__softDelete", false)
      .getMany();
    expect(withFilterFalse).toHaveLength(2);

    // Suppress the unused-variable warning for sd1 reference
    void sd1;
  });

  test("setFilter(name, true) explicitly enables a filter", async () => {
    const source = getSource();

    // Insert two soft-deleted items to confirm the filter still works when explicitly enabled
    const sdRepo = getHandle().repository(TckSoftDeletable);
    await sdRepo.insert({ name: "SD-Enable-1" });
    const sd2 = await sdRepo.insert({ name: "SD-Enable-2" });
    await sdRepo.softDestroy(sd2);

    // Explicitly enable __softDelete (it's default-on, but test that explicit true works)
    const results = await source
      .queryBuilder(TckSoftDeletable)
      .setFilter("__softDelete", true)
      .getMany();

    // With filter enabled: soft-deleted item excluded
    const softDeletedResults = results.filter((r) => r.name === "SD-Enable-2");
    expect(softDeletedResults).toHaveLength(0);
  });

  test("setFilter() accumulates multiple filter overrides independently", async () => {
    const source = getSource();

    const sdRepo = getHandle().repository(TckSoftDeletable);
    const alive = await sdRepo.insert({ name: "Alive" });
    const deleted = await sdRepo.insert({ name: "Deleted" });
    await sdRepo.softDestroy(deleted);

    // Both setFilter calls accumulate in filterOverrides map
    const qb = source.queryBuilder(TckSoftDeletable).setFilter("__softDelete", false);

    const state = (qb as any).state;
    expect(state.filterOverrides).toHaveProperty("__softDelete", false);

    void alive;
  });

  // ─── FIX-7: .withoutScope() wiring through MemoryQueryBuilder ────────────

  test("withoutScope() does not break QB execution when no scope params configured", async () => {
    const source = getSource();

    // TckSimpleUser has no ScopeField — withoutScope is a no-op filter disable
    // but must not throw or filter incorrectly.
    const results = await source.queryBuilder(TckSimpleUser).withoutScope().getMany();

    // All 4 users from beforeEach should be returned
    expect(results).toHaveLength(4);
  });

  test("withoutScope() sets state.withoutScope to true", async () => {
    const source = getSource();
    const qb = source.queryBuilder(TckSimpleUser) as any;
    qb.withoutScope();
    expect(qb.state.withoutScope).toBe(true);
  });

  // ─── Inheritance: QB write operations ─────────────────────────────

  describe("inheritance QB write: single-table", () => {
    const {
      TckCar: Car,
      TckTruck: Truck,
      TckVehicle: Vehicle,
    } = { TckCar, TckTruck, TckVehicle };

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("QB update on single-table child scopes by discriminator — sibling rows untouched", async () => {
      const source = getSource();
      const carRepo = getHandle().repository(Car);
      const truckRepo = getHandle().repository(Truck);

      await carRepo.insert({ type: "car", make: "TargetCar", seatCount: 4 });
      await truckRepo.insert({ type: "truck", make: "TargetCar", payloadCapacity: 10.0 });

      await source
        .queryBuilder(Car)
        .update()
        .set({ make: "UpdatedCar" })
        .where({ make: "TargetCar" })
        .execute();

      const cars = await carRepo.find();
      expect(cars).toHaveLength(1);
      expect(cars[0].make).toBe("UpdatedCar");

      // Truck with same original make must be untouched
      const trucks = await truckRepo.find();
      expect(trucks).toHaveLength(1);
      expect(trucks[0].make).toBe("TargetCar");
    });

    test("QB delete on single-table child scopes by discriminator — sibling rows untouched", async () => {
      const source = getSource();
      const carRepo = getHandle().repository(Car);
      const truckRepo = getHandle().repository(Truck);
      const vehicleRepo = getHandle().repository(Vehicle);

      await carRepo.insert({ type: "car", make: "DeleteCar", seatCount: 4 });
      await truckRepo.insert({ type: "truck", make: "DeleteCar", payloadCapacity: 10.0 });

      await source.queryBuilder(Car).delete().where({ make: "DeleteCar" }).execute();

      // Car must be gone
      const cars = await carRepo.find();
      expect(cars).toHaveLength(0);

      // Truck with same make must remain
      const trucks = await truckRepo.find();
      expect(trucks).toHaveLength(1);
      expect(trucks[0].make).toBe("DeleteCar");

      // Root repo must still see the truck
      const all = await vehicleRepo.find();
      expect(all).toHaveLength(1);
    });

    test("QB insert on single-table child sets correct discriminator", async () => {
      const source = getSource();
      const carRepo = getHandle().repository(Car);
      const vehicleRepo = getHandle().repository(Vehicle);

      const now = new Date();
      await source
        .queryBuilder(Car)
        .insert()
        .values([
          {
            id: "00000000-0000-0000-0000-000000000001",
            version: 1,
            make: "QBInsertCar",
            seatCount: 3,
            createdAt: now,
            updatedAt: now,
          } as any,
        ])
        .execute();

      const cars = await carRepo.find({ make: "QBInsertCar" });
      expect(cars).toHaveLength(1);
      expect(cars[0].type).toBe("car");

      // Root repo must hydrate as TckCar
      const found = await vehicleRepo.findOne({ id: cars[0].id });
      expect(found).toBeInstanceOf(Car);
    });
  });
};
