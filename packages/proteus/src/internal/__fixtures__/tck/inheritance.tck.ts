import { describe, test, it, expect, beforeEach } from "vitest";
// TCK: Inheritance Suite
// Tests table inheritance strategies (single-table and joined) for cross-driver portability.
// Structural assertions only (no snapshots).

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import type { ProteusSource } from "../../../classes/ProteusSource";
import { ProteusError } from "../../../errors/ProteusError";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError";

// ─── Single-Table Inheritance Suite ─────────────────────────────────────────

export const inheritanceSingleTableSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
) => {
  describe("Inheritance (single-table)", () => {
    const { TckVehicle, TckCar, TckTruck } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    // ─── Happy Paths ──────────────────────────────────────────────────

    test("inserts a child entity and retrieves it with correct type", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Toyota", seatCount: 5 });

      expect(car).toBeInstanceOf(TckCar);
      expect(car.id).toBeDefined();
      expect(car.type).toBe("car");
      expect(car.make).toBe("Toyota");
      expect(car.seatCount).toBe(5);
      expect(car.version).toBe(1);
      expect(car.createdAt).toBeInstanceOf(Date);
      expect(car.updatedAt).toBeInstanceOf(Date);
    });

    test("inserts multiple subtypes and queries via root repo — polymorphic hydration", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);
      const vehicleRepo = getHandle().repository(TckVehicle);

      await carRepo.insert({ type: "car", make: "Honda", seatCount: 4 });
      await truckRepo.insert({ type: "truck", make: "Ford", payloadCapacity: 2.5 });

      const vehicles = await vehicleRepo.find();

      expect(vehicles).toHaveLength(2);

      const car = vehicles.find((v) => v instanceof TckCar);
      const truck = vehicles.find((v) => v instanceof TckTruck);

      expect(car).toBeDefined();
      expect(truck).toBeDefined();
    });

    test("child repo returns only matching discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "BMW", seatCount: 4 });
      await truckRepo.insert({ type: "truck", make: "Mack", payloadCapacity: 15.0 });

      const cars = await carRepo.find();
      expect(cars).toHaveLength(1);
      expect(cars[0]).toBeInstanceOf(TckCar);
      expect(cars[0].make).toBe("BMW");
    });

    test("child repo count only counts matching discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "Audi", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "VW", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "Scania", payloadCapacity: 22.0 });

      const carCount = await carRepo.count();
      expect(carCount).toBe(2);
    });

    test("child repo exists returns true only for matching type", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      const car = await carRepo.insert({ type: "car", make: "Fiat", seatCount: 4 });

      const carExists = await carRepo.exists({ id: car.id });
      expect(carExists).toBe(true);

      const truckExists = await truckRepo.exists({ id: car.id });
      expect(truckExists).toBe(false);
    });

    test("update preserves discriminator and updates fields", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Seat", seatCount: 5 });

      car.make = "Cupra";
      const updated = await carRepo.update(car);

      expect(updated.type).toBe("car");
      expect(updated.make).toBe("Cupra");
      expect(updated).toBeInstanceOf(TckCar);
    });

    test("delete removes only the targeted entity", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      const car = await carRepo.insert({ type: "car", make: "Peugeot", seatCount: 5 });
      const truck = await truckRepo.insert({
        type: "truck",
        make: "Isuzu",
        payloadCapacity: 5.0,
      });

      await carRepo.destroy(car);

      const foundCar = await carRepo.findOne({ id: car.id });
      expect(foundCar).toBeNull();

      const foundTruck = await truckRepo.findOne({ id: truck.id });
      expect(foundTruck).not.toBeNull();
      expect(foundTruck!.make).toBe("Isuzu");
    });

    test("findOne on root repo returns correct subtype", async () => {
      const carRepo = getHandle().repository(TckCar);
      const vehicleRepo = getHandle().repository(TckVehicle);

      const car = await carRepo.insert({ type: "car", make: "Renault", seatCount: 5 });

      const found = await vehicleRepo.findOne({ id: car.id });

      expect(found).not.toBeNull();
      expect(found).toBeInstanceOf(TckCar);
    });

    test("save (upsert) on child entity works", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Nissan", seatCount: 5 });
      expect(car.version).toBe(1);

      car.make = "Infiniti";
      const saved = await carRepo.save(car);

      expect(saved.make).toBe("Infiniti");
      expect(saved.version).toBe(2);
      expect(saved).toBeInstanceOf(TckCar);
    });

    test("root repo findAndCount returns all subtypes with correct count", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);
      const vehicleRepo = getHandle().repository(TckVehicle);

      await carRepo.insert({ type: "car", make: "C1", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "C2", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "T1", payloadCapacity: 10.0 });

      const [entities, count] = await vehicleRepo.findAndCount();

      expect(entities).toHaveLength(3);
      expect(count).toBe(3);
    });

    test("instanceof checks work on polymorphic results", async () => {
      const carRepo = getHandle().repository(TckCar);
      const vehicleRepo = getHandle().repository(TckVehicle);

      const car = await carRepo.insert({ type: "car", make: "Subaru", seatCount: 5 });

      const results = await vehicleRepo.find({ id: car.id });
      expect(results).toHaveLength(1);

      const entity = results[0];
      expect(entity instanceof TckCar).toBe(true);
      expect(entity instanceof TckVehicle).toBe(true);
      expect(entity instanceof TckTruck).toBe(false);
    });

    test("findOneOrSave returns existing child entity if found", async () => {
      const carRepo = getHandle().repository(TckCar);

      const inserted = await carRepo.insert({
        type: "car",
        make: "FindOrSave",
        seatCount: 4,
      });

      const result = await carRepo.findOneOrSave(
        { make: "FindOrSave" },
        { type: "car", make: "FindOrSave", seatCount: 4 },
      );
      expect(result.id).toBe(inserted.id);
      expect(result).toBeInstanceOf(TckCar);
    });

    test("findOneOrSave inserts child entity if not found", async () => {
      const carRepo = getHandle().repository(TckCar);

      const result = await carRepo.findOneOrSave(
        { make: "NewCar" },
        { type: "car", make: "NewCar", seatCount: 7 },
      );
      expect(result.id).toBeDefined();
      expect(result.make).toBe("NewCar");
      expect(result.seatCount).toBe(7);
      expect(result).toBeInstanceOf(TckCar);
    });

    test("find with criteria on child-specific field", async () => {
      const carRepo = getHandle().repository(TckCar);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "C", seatCount: 5 });

      const results = await carRepo.find({ seatCount: 5 });
      expect(results).toHaveLength(2);
      expect(results.every((c) => c.seatCount === 5)).toBe(true);
    });

    test("root repo find with shared field criteria returns polymorphic results", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);
      const vehicleRepo = getHandle().repository(TckVehicle);

      await carRepo.insert({ type: "car", make: "SharedMake", seatCount: 4 });
      await truckRepo.insert({
        type: "truck",
        make: "SharedMake",
        payloadCapacity: 10.0,
      });
      await carRepo.insert({ type: "car", make: "OtherMake", seatCount: 2 });

      const results = await vehicleRepo.find({ make: "SharedMake" });
      expect(results).toHaveLength(2);

      const car = results.find((v) => v instanceof TckCar);
      const truck = results.find((v) => v instanceof TckTruck);
      expect(car).toBeDefined();
      expect(truck).toBeDefined();
    });

    test("count with criteria on child repo filters within discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "CountMe", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "CountMe", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "Other", seatCount: 2 });
      await truckRepo.insert({ type: "truck", make: "CountMe", payloadCapacity: 10.0 });

      const count = await carRepo.count({ make: "CountMe" });
      expect(count).toBe(2);
    });

    test("duplicate insert on child repo rejects", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "DupCar", seatCount: 4 });

      await expect(carRepo.insert(car)).rejects.toThrow(ProteusRepositoryError);
    });

    // ─── Batch Operations ─────────────────────────────────────────────

    test("batch insert creates multiple child entities of same type", async () => {
      const carRepo = getHandle().repository(TckCar);

      const cars = await carRepo.insert([
        { type: "car", make: "Car1", seatCount: 2 },
        { type: "car", make: "Car2", seatCount: 4 },
        { type: "car", make: "Car3", seatCount: 7 },
      ]);

      expect(cars).toHaveLength(3);
      expect(cars[0]).toBeInstanceOf(TckCar);
      expect(cars[1]).toBeInstanceOf(TckCar);
      expect(cars[2]).toBeInstanceOf(TckCar);

      const ids = new Set(cars.map((c) => c.id));
      expect(ids.size).toBe(3);

      // Discriminator filter — only cars visible in car repo
      const found = await carRepo.find();
      expect(found).toHaveLength(3);
    });

    test("batch update modifies multiple child entities", async () => {
      const carRepo = getHandle().repository(TckCar);

      const [c1, c2] = await carRepo.insert([
        { type: "car", make: "OldMake1", seatCount: 4 },
        { type: "car", make: "OldMake2", seatCount: 5 },
      ]);

      c1.make = "NewMake1";
      c2.make = "NewMake2";
      const updated = await carRepo.update([c1, c2]);

      expect(updated).toHaveLength(2);
      expect(updated[0].make).toBe("NewMake1");
      expect(updated[1].make).toBe("NewMake2");
      expect(updated[0].version).toBe(2);
      expect(updated[1].version).toBe(2);
      expect(updated[0]).toBeInstanceOf(TckCar);
    });

    test("batch destroy removes multiple child entities", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      const [c1, c2] = await carRepo.insert([
        { type: "car", make: "Del1", seatCount: 4 },
        { type: "car", make: "Del2", seatCount: 5 },
      ]);
      await truckRepo.insert({ type: "truck", make: "Survivor", payloadCapacity: 10.0 });

      await carRepo.destroy([c1, c2]);

      const remainingCars = await carRepo.find();
      expect(remainingCars).toHaveLength(0);

      const remainingTrucks = await truckRepo.find();
      expect(remainingTrucks).toHaveLength(1);
    });

    // ─── Clone and Copy ───────────────────────────────────────────────

    test("clone on child entity creates new entity with same type and new PK", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Original", seatCount: 5 });
      const cloned = await carRepo.clone(car);

      expect(cloned.id).not.toBe(car.id);
      expect(cloned).toBeInstanceOf(TckCar);
      expect(cloned.type).toBe("car");
      expect(cloned.make).toBe("Original");
      expect(cloned.seatCount).toBe(5);
      expect(cloned.version).toBe(1);
    });

    test("copy on child entity produces independent deep copy with same type", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Source", seatCount: 4 });
      const copied = carRepo.copy(car);

      expect(copied.id).toBe(car.id);
      expect(copied).toBeInstanceOf(TckCar);
      expect(copied.type).toBe("car");
      expect(copied.make).toBe("Source");

      // Mutation of copy does not affect original
      copied.make = "Mutated";
      expect(car.make).toBe("Source");
    });

    // ─── Criteria-Based Bulk Operations ──────────────────────────────

    test("delete by criteria on child repo only removes matching discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "DeleteMe", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "KeepMe", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "DeleteMe", payloadCapacity: 10.0 });

      // Delete by make — child repo should only delete cars with make="DeleteMe"
      await carRepo.delete({ make: "DeleteMe" });

      const cars = await carRepo.find();
      expect(cars).toHaveLength(1);
      expect(cars[0].make).toBe("KeepMe");

      // Truck with same make must remain (different discriminator)
      const trucks = await truckRepo.find();
      expect(trucks).toHaveLength(1);
      expect(trucks[0].make).toBe("DeleteMe");
    });

    test("updateMany on child repo only updates matching discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "TargetBrand", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "OtherBrand", seatCount: 5 });
      await truckRepo.insert({
        type: "truck",
        make: "TargetBrand",
        payloadCapacity: 10.0,
      });

      // updateMany should only affect cars with make="TargetBrand"
      await carRepo.updateMany({ make: "TargetBrand" }, { make: "UpdatedBrand" });

      const cars = await carRepo.find();
      const updatedCar = cars.find((c) => c.seatCount === 4);
      expect(updatedCar).toBeDefined();
      expect(updatedCar!.make).toBe("UpdatedBrand");

      // Truck must be untouched
      const trucks = await truckRepo.find();
      expect(trucks[0].make).toBe("TargetBrand");
    });

    test("updateMany can update child-specific fields", async () => {
      const carRepo = getHandle().repository(TckCar);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "C", seatCount: 5 });

      await carRepo.updateMany({ seatCount: 2 }, { seatCount: 4 });

      const updated = await carRepo.find({ seatCount: 4 });
      expect(updated).toHaveLength(2);

      // Unmatched car is untouched
      const unchanged = await carRepo.find({ seatCount: 5 });
      expect(unchanged).toHaveLength(1);
    });

    test("delete by child-specific field criteria removes only matching", async () => {
      const carRepo = getHandle().repository(TckCar);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "C", seatCount: 2 });

      await carRepo.delete({ seatCount: 2 });

      const remaining = await carRepo.find();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].make).toBe("B");
    });

    // ─── Aggregate Operations ─────────────────────────────────────────

    test("sum on child repo respects discriminator filter", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 4 });
      // Trucks have no seatCount — seatCount is car-only
      await truckRepo.insert({ type: "truck", make: "T", payloadCapacity: 10.0 });

      const total = await carRepo.sum("seatCount");
      // Only car seatCounts should be summed (2 + 4 = 6)
      expect(total).toBe(6);
    });

    test("average on child repo respects discriminator filter", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 6 });
      await truckRepo.insert({ type: "truck", make: "T", payloadCapacity: 10.0 });

      const avg = await carRepo.average("seatCount");
      expect(avg).toBe(4);
    });

    test("minimum on child repo respects discriminator filter", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "T", payloadCapacity: 1.0 });

      const min = await carRepo.minimum("seatCount");
      expect(min).toBe(2);
    });

    test("maximum on child repo respects discriminator filter", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 7 });
      await truckRepo.insert({ type: "truck", make: "T", payloadCapacity: 99.0 });

      const max = await carRepo.maximum("seatCount");
      expect(max).toBe(7);
    });

    test("sum with criteria on child repo filters before aggregating", async () => {
      const carRepo = getHandle().repository(TckCar);

      await carRepo.insert({ type: "car", make: "Target", seatCount: 3 });
      await carRepo.insert({ type: "car", make: "Target", seatCount: 7 });
      await carRepo.insert({ type: "car", make: "Other", seatCount: 100 });

      const total = await carRepo.sum("seatCount", { make: "Target" });
      expect(total).toBe(10);
    });

    test("aggregate on root repo operates across all subtypes", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);
      const vehicleRepo = getHandle().repository(TckVehicle);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await truckRepo.insert({ type: "truck", make: "B", payloadCapacity: 10.0 });
      await carRepo.insert({ type: "car", make: "C", seatCount: 5 });

      // version is a shared root field present on all subtypes
      const count = await vehicleRepo.count();
      expect(count).toBe(3);

      // sum on root repo across all subtypes — version is 1 for all three
      const versionSum = await vehicleRepo.sum("version");
      expect(versionSum).toBe(3);
    });

    test("aggregate returns null for empty child repo", async () => {
      const carRepo = getHandle().repository(TckCar);

      const sum = await carRepo.sum("seatCount");
      expect(sum).toBeNull();

      const avg = await carRepo.average("seatCount");
      expect(avg).toBeNull();

      const min = await carRepo.minimum("seatCount");
      expect(min).toBeNull();

      const max = await carRepo.maximum("seatCount");
      expect(max).toBeNull();
    });

    // ─── findAndCount on Child Repo ───────────────────────────────────

    test("findAndCount on child repo returns only matching discriminator with correct count", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "C1", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "C2", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "T1", payloadCapacity: 10.0 });

      const [cars, carCount] = await carRepo.findAndCount();

      expect(cars).toHaveLength(2);
      expect(carCount).toBe(2);
      expect(cars.every((c) => c instanceof TckCar)).toBe(true);
    });

    test("findAndCount on child repo with limit returns total across all matching", async () => {
      const carRepo = getHandle().repository(TckCar);

      await carRepo.insert({ type: "car", make: "X1", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "X2", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "X3", seatCount: 2 });

      const [limited, total] = await carRepo.findAndCount(undefined, {
        limit: 1,
        order: { make: "ASC" },
      });

      expect(limited).toHaveLength(1);
      expect(total).toBe(3);
    });

    // ─── Ordering and Pagination ──────────────────────────────────────

    test("ordered find on child repo respects discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "Zephyr", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "Alpha", seatCount: 4 });
      await truckRepo.insert({ type: "truck", make: "Mover", payloadCapacity: 10.0 });

      const cars = await carRepo.find(undefined, { order: { make: "ASC" } });

      expect(cars).toHaveLength(2);
      expect(cars[0].make).toBe("Alpha");
      expect(cars[1].make).toBe("Zephyr");
    });

    test("find with limit and offset on child repo stays within discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "C", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "T", payloadCapacity: 10.0 });

      const page = await carRepo.find(undefined, {
        limit: 2,
        offset: 1,
        order: { make: "ASC" },
      });

      expect(page).toHaveLength(2);
      expect(page[0].make).toBe("B");
      expect(page[1].make).toBe("C");
    });

    // ─── Advanced Query Operators ───────────────────────────────────────

    test("find with $gt operator on child-specific field", async () => {
      const carRepo = getHandle().repository(TckCar);

      await carRepo.insert({ type: "car", make: "A", seatCount: 2 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "C", seatCount: 7 });

      const results = await carRepo.find(
        { seatCount: { $gt: 4 } },
        { order: { make: "ASC" } },
      );
      expect(results).toHaveLength(2);
      expect(results[0].seatCount).toBe(5);
      expect(results[1].seatCount).toBe(7);
    });

    test("find with $in operator on shared field via child repo", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "Alpha", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "Beta", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "Gamma", seatCount: 2 });
      await truckRepo.insert({ type: "truck", make: "Alpha", payloadCapacity: 10.0 });

      const results = await carRepo.find(
        { make: { $in: ["Alpha", "Gamma"] } },
        { order: { make: "ASC" } },
      );
      // Only cars with matching makes — truck with "Alpha" excluded by discriminator
      expect(results).toHaveLength(2);
      expect(results[0].make).toBe("Alpha");
      expect(results[1].make).toBe("Gamma");
    });

    test("find with $like operator on shared field via child repo", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      await carRepo.insert({ type: "car", make: "Toyota Corolla", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "Toyota Camry", seatCount: 5 });
      await carRepo.insert({ type: "car", make: "Honda Civic", seatCount: 5 });
      await truckRepo.insert({
        type: "truck",
        make: "Toyota Hilux",
        payloadCapacity: 5.0,
      });

      const results = await carRepo.find(
        { make: { $like: "Toyota%" } },
        { order: { make: "ASC" } },
      );
      // Only cars matching — truck excluded by discriminator
      expect(results).toHaveLength(2);
      expect(results[0].make).toBe("Toyota Camry");
      expect(results[1].make).toBe("Toyota Corolla");
    });

    // ─── findOneOrFail ────────────────────────────────────────────────

    test("findOneOrFail on child repo throws when entity belongs to different subtype", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      const car = await carRepo.insert({ type: "car", make: "Lada", seatCount: 5 });

      await expect(truckRepo.findOneOrFail({ id: car.id })).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("findOneOrFail on child repo succeeds for correct subtype", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Lada", seatCount: 5 });

      const found = await carRepo.findOneOrFail({ id: car.id });
      expect(found).toBeInstanceOf(TckCar);
      expect(found.make).toBe("Lada");
    });

    // ─── Edge Cases ───────────────────────────────────────────────────

    test("empty hierarchy returns empty array", async () => {
      const vehicleRepo = getHandle().repository(TckVehicle);

      const results = await vehicleRepo.find();
      expect(results).toHaveLength(0);
    });

    test("child repo returns empty array when no matching discriminator rows exist", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      // Insert only trucks
      await truckRepo.insert({ type: "truck", make: "Only", payloadCapacity: 5.0 });

      const cars = await carRepo.find();
      expect(cars).toHaveLength(0);
    });

    test("exists returns false on empty store", async () => {
      const carRepo = getHandle().repository(TckCar);

      const result = await carRepo.exists({ make: "Anything" });
      expect(result).toBe(false);
    });

    test("findOne for wrong discriminator type returns null", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);

      const car = await carRepo.insert({ type: "car", make: "Mazda", seatCount: 4 });

      const found = await truckRepo.findOne({ id: car.id });
      expect(found).toBeNull();
    });

    test("version increments correctly on child update", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Volvo", seatCount: 5 });
      expect(car.version).toBe(1);

      car.make = "Polestar";
      const updated = await carRepo.update(car);
      expect(updated.version).toBe(2);
    });

    test("optimistic lock conflict on stale child entity", async () => {
      const carRepo = getHandle().repository(TckCar);

      const car = await carRepo.insert({ type: "car", make: "Hyundai", seatCount: 5 });

      const stale = carRepo.copy(car);

      car.make = "Genesis";
      await carRepo.update(car);

      stale.make = "Kia";
      await expect(carRepo.update(stale)).rejects.toThrow(ProteusError);
    });

    test("child-specific fields are undefined for other subtypes in root query", async () => {
      const truckRepo = getHandle().repository(TckTruck);
      const vehicleRepo = getHandle().repository(TckVehicle);

      await truckRepo.insert({ type: "truck", make: "DAF", payloadCapacity: 17.5 });

      const vehicles = await vehicleRepo.find();
      expect(vehicles).toHaveLength(1);

      const truck = vehicles[0] as any;
      // The Truck entity should NOT have seatCount (a Car-specific field)
      expect(truck.seatCount).toBeUndefined();
    });

    test("child-specific nullable fields survive round-trip as null when not provided", async () => {
      const carRepo = getHandle().repository(TckCar);

      // Insert a car without explicitly setting seatCount (nullable field)
      const car = await carRepo.insert({ type: "car", make: "Minimal" });

      const found = await carRepo.findOne({ id: car.id });
      expect(found).not.toBeNull();
      // seatCount is @Nullable — should be null when not provided
      expect(found!.seatCount).toBeNull();
    });

    test("child entity fields survive round-trip", async () => {
      const truckRepo = getHandle().repository(TckTruck);

      const truck = await truckRepo.insert({
        type: "truck",
        make: "BigRig",
        payloadCapacity: 22.5,
      });

      const found = await truckRepo.findOne({ id: truck.id });
      expect(found).not.toBeNull();
      expect(found!.make).toBe("BigRig");
      expect(found!.payloadCapacity).toBe(22.5);
      expect(found!.type).toBe("truck");
    });

    test("root repo find by discriminator value returns correct subtypes", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);
      const vehicleRepo = getHandle().repository(TckVehicle);

      await carRepo.insert({ type: "car", make: "A", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "B", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "C", payloadCapacity: 10.0 });

      const cars = await vehicleRepo.find({ type: "car" });
      expect(cars).toHaveLength(2);
      expect(cars.every((v) => v instanceof TckCar)).toBe(true);
    });

    test("count on empty child repo returns zero", async () => {
      const carRepo = getHandle().repository(TckCar);

      const count = await carRepo.count();
      expect(count).toBe(0);
    });

    // ─── Clear on Child ───────────────────────────────────────────────

    test("clear() on single-table child removes only rows of that discriminator type", async () => {
      const carRepo = getHandle().repository(TckCar);
      const truckRepo = getHandle().repository(TckTruck);
      const vehicleRepo = getHandle().repository(TckVehicle);

      await carRepo.insert({ type: "car", make: "ClearMe1", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "ClearMe2", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "Survivor", payloadCapacity: 10.0 });

      await carRepo.clear();

      // All cars must be gone
      const cars = await carRepo.find();
      expect(cars).toHaveLength(0);

      // The truck must remain — different discriminator, same root table
      const trucks = await truckRepo.find();
      expect(trucks).toHaveLength(1);
      expect(trucks[0].make).toBe("Survivor");

      // Root repo must see only the surviving truck
      const all = await vehicleRepo.find();
      expect(all).toHaveLength(1);
    });

    // ─── Save-Insert Path (upsert with new entity) ────────────────────

    test("save() with no id inserts new single-table child with correct discriminator", async () => {
      const carRepo = getHandle().repository(TckCar);
      const vehicleRepo = getHandle().repository(TckVehicle);

      const saved = await carRepo.save({ type: "car", make: "SaveNew", seatCount: 4 });

      expect(saved.id).toBeDefined();
      expect(saved.type).toBe("car");
      expect(saved).toBeInstanceOf(TckCar);
      expect(saved.version).toBe(1);

      // Re-fetch through root repo must still return TckCar
      const found = await vehicleRepo.findOne({ id: saved.id });
      expect(found).not.toBeNull();
      expect(found).toBeInstanceOf(TckCar);
      expect((found as any).type).toBe("car");
    });
  });
};

// ─── Joined Inheritance Suite ───────────────────────────────────────────────

export const inheritanceJoinedSuite = (
  getHandle: () => TckDriverHandle,
  entities: TckEntities,
  getSource: () => ProteusSource,
) => {
  describe("Inheritance (joined)", () => {
    const { TckAnimal, TckDog, TckCat } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    // ─── Happy Paths ──────────────────────────────────────────────────

    test("inserts a joined child entity and retrieves it with all fields", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Labrador" });

      const found = await dogRepo.findOne({ id: dog.id });

      expect(found).not.toBeNull();
      expect(found).toBeInstanceOf(TckDog);
      expect(found!.name).toBe("Rex");
      expect(found!.breed).toBe("Labrador");
      expect(found!.kind).toBe("dog");
      expect(found!.version).toBe(1);
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.updatedAt).toBeInstanceOf(Date);
    });

    test("polymorphic query via root repo returns both subtypes", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "Max", breed: "Poodle" });
      await catRepo.insert({ kind: "cat", name: "Luna", isIndoor: true });

      const animals = await animalRepo.find();

      expect(animals).toHaveLength(2);

      const dog = animals.find((a) => a instanceof TckDog);
      const cat = animals.find((a) => a instanceof TckCat);

      expect(dog).toBeDefined();
      expect(cat).toBeDefined();
    });

    test("child repo discriminator filtering works", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "Buddy", breed: "Beagle" });
      await catRepo.insert({ kind: "cat", name: "Nala", isIndoor: true });

      const dogs = await dogRepo.find();
      expect(dogs).toHaveLength(1);
      expect(dogs[0]).toBeInstanceOf(TckDog);
      expect(dogs[0].name).toBe("Buddy");
    });

    test("update root-only fields on joined child", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({
        kind: "dog",
        name: "Charlie",
        breed: "Spaniel",
      });

      dog.name = "Charles";
      await dogRepo.update(dog);

      const refetched = await dogRepo.findOne({ id: dog.id });
      expect(refetched).not.toBeNull();
      expect(refetched!.name).toBe("Charles");
      expect(refetched!.breed).toBe("Spaniel");
    });

    test("update child-only fields on joined child", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Labrador" });

      dog.breed = "Golden Retriever";
      await dogRepo.update(dog);

      const refetched = await dogRepo.findOne({ id: dog.id });
      expect(refetched).not.toBeNull();
      expect(refetched!.name).toBe("Rex");
      expect(refetched!.breed).toBe("Golden Retriever");
    });

    test("update both root and child fields", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "Buddy", breed: "Beagle" });

      dog.name = "Max";
      dog.breed = "Poodle";
      await dogRepo.update(dog);

      const refetched = await dogRepo.findOne({ id: dog.id });
      expect(refetched).not.toBeNull();
      expect(refetched!.name).toBe("Max");
      expect(refetched!.breed).toBe("Poodle");
    });

    test("delete cascades to child table", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const animalRepo = getHandle().repository(TckAnimal);

      const dog = await dogRepo.insert({ kind: "dog", name: "Bailey", breed: "Husky" });

      await dogRepo.destroy(dog);

      const foundDog = await dogRepo.findOne({ id: dog.id });
      expect(foundDog).toBeNull();

      const foundAnimal = await animalRepo.findOne({ id: dog.id });
      expect(foundAnimal).toBeNull();
    });

    test("count and exists work on joined child repo", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const dog = await dogRepo.insert({ kind: "dog", name: "Koda", breed: "Samoyed" });
      await catRepo.insert({ kind: "cat", name: "Whiskers", isIndoor: false });

      const dogCount = await dogRepo.count();
      expect(dogCount).toBe(1);

      const dogExists = await dogRepo.exists({ id: dog.id });
      expect(dogExists).toBe(true);
    });

    test("findOne on root repo returns correct subtype for joined child", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const animalRepo = getHandle().repository(TckAnimal);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rover", breed: "Terrier" });

      const found = await animalRepo.findOne({ id: dog.id });

      expect(found).not.toBeNull();
      expect(found).toBeInstanceOf(TckDog);
      expect((found as any).breed).toBe("Terrier");
    });

    test("findOneOrSave returns existing joined child entity if found", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const inserted = await dogRepo.insert({
        kind: "dog",
        name: "FindDog",
        breed: "Setter",
      });

      const result = await dogRepo.findOneOrSave(
        { name: "FindDog" },
        { kind: "dog", name: "FindDog", breed: "Setter" },
      );
      expect(result.id).toBe(inserted.id);
      expect(result).toBeInstanceOf(TckDog);
    });

    test("findOneOrSave inserts joined child entity if not found", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const result = await dogRepo.findOneOrSave(
        { name: "NewDog" },
        { kind: "dog", name: "NewDog", breed: "Retriever" },
      );
      expect(result.id).toBeDefined();
      expect(result.name).toBe("NewDog");
      expect(result.breed).toBe("Retriever");
      expect(result).toBeInstanceOf(TckDog);
    });

    test("save (upsert) on joined child entity inserts as new", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const saved = await dogRepo.save({ kind: "dog", name: "NewDog", breed: "Setter" });

      expect(saved.id).toBeDefined();
      expect(saved).toBeInstanceOf(TckDog);
      expect(saved.version).toBe(1);
      expect(saved.name).toBe("NewDog");
      expect(saved.breed).toBe("Setter");
    });

    test("save (upsert) on existing joined child entity updates", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "OldName", breed: "Pug" });
      dog.name = "NewName";
      const saved = await dogRepo.save(dog);

      expect(saved.id).toBe(dog.id);
      expect(saved.version).toBe(2);
      expect(saved.name).toBe("NewName");
      expect(saved.breed).toBe("Pug");
    });

    test("find with criteria on child-specific field", async () => {
      const dogRepo = getHandle().repository(TckDog);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "Labrador" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Poodle" });
      await dogRepo.insert({ kind: "dog", name: "D3", breed: "Labrador" });

      const results = await dogRepo.find({ breed: "Labrador" });
      expect(results).toHaveLength(2);
      expect(results.every((d) => d.breed === "Labrador")).toBe(true);
    });

    test("root repo find with shared field criteria returns polymorphic results", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "SharedName", breed: "Lab" });
      await catRepo.insert({ kind: "cat", name: "SharedName", isIndoor: true });
      await dogRepo.insert({ kind: "dog", name: "OtherName", breed: "Pug" });

      const results = await animalRepo.find({ name: "SharedName" });
      expect(results).toHaveLength(2);

      const dog = results.find((a) => a instanceof TckDog);
      const cat = results.find((a) => a instanceof TckCat);
      expect(dog).toBeDefined();
      expect(cat).toBeDefined();
    });

    test("count with criteria on joined child repo filters within discriminator", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "CountMe", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "CountMe", breed: "Pug" });
      await dogRepo.insert({ kind: "dog", name: "Other", breed: "Beagle" });
      await catRepo.insert({ kind: "cat", name: "CountMe", isIndoor: true });

      const count = await dogRepo.count({ name: "CountMe" });
      expect(count).toBe(2);
    });

    test("duplicate insert on joined child repo rejects", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "DupDog", breed: "Setter" });

      await expect(dogRepo.insert(dog)).rejects.toThrow(ProteusRepositoryError);
    });

    // ─── Batch Operations ─────────────────────────────────────────────

    test("batch insert creates multiple joined child entities", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dogs = await dogRepo.insert([
        { kind: "dog", name: "Dog1", breed: "Poodle" },
        { kind: "dog", name: "Dog2", breed: "Beagle" },
      ]);

      expect(dogs).toHaveLength(2);
      expect(dogs[0]).toBeInstanceOf(TckDog);
      expect(dogs[1]).toBeInstanceOf(TckDog);

      const ids = new Set(dogs.map((d) => d.id));
      expect(ids.size).toBe(2);

      const found = await dogRepo.find();
      expect(found).toHaveLength(2);
    });

    test("batch update on joined child entities", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const [d1, d2] = await dogRepo.insert([
        { kind: "dog", name: "D1", breed: "Breed1" },
        { kind: "dog", name: "D2", breed: "Breed2" },
      ]);

      d1.breed = "UpdatedBreed1";
      d2.name = "UpdatedD2";
      const updated = await dogRepo.update([d1, d2]);

      expect(updated).toHaveLength(2);
      expect(updated[0].version).toBe(2);
      expect(updated[1].version).toBe(2);
    });

    test("batch destroy removes multiple joined child entities", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const [d1, d2] = await dogRepo.insert([
        { kind: "dog", name: "DelDog1", breed: "Lab" },
        { kind: "dog", name: "DelDog2", breed: "Pug" },
      ]);
      await catRepo.insert({ kind: "cat", name: "SurvivorCat", isIndoor: true });

      await dogRepo.destroy([d1, d2]);

      const dogs = await dogRepo.find();
      expect(dogs).toHaveLength(0);

      const cats = await catRepo.find();
      expect(cats).toHaveLength(1);
    });

    // ─── Clone and Copy ───────────────────────────────────────────────

    test("clone on joined child entity creates new entity preserving subtype", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({
        kind: "dog",
        name: "Original",
        breed: "Collie",
      });
      const cloned = await dogRepo.clone(dog);

      expect(cloned.id).not.toBe(dog.id);
      expect(cloned).toBeInstanceOf(TckDog);
      expect(cloned.kind).toBe("dog");
      expect(cloned.name).toBe("Original");
      expect(cloned.breed).toBe("Collie");
      expect(cloned.version).toBe(1);
    });

    test("copy on joined child entity produces independent deep copy", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({
        kind: "dog",
        name: "Source",
        breed: "Dalmatian",
      });
      const copied = dogRepo.copy(dog);

      expect(copied.id).toBe(dog.id);
      expect(copied).toBeInstanceOf(TckDog);
      expect(copied.breed).toBe("Dalmatian");

      // Mutation of copy does not affect original
      copied.breed = "Mutated";
      expect(dog.breed).toBe("Dalmatian");
    });

    // ─── Criteria-Based Bulk Operations ──────────────────────────────

    test("delete by criteria on joined child repo cascades to child table", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      const dog = await dogRepo.insert({ kind: "dog", name: "DeleteMe", breed: "Mutt" });
      await catRepo.insert({ kind: "cat", name: "KeepMe", isIndoor: true });

      await dogRepo.delete({ name: "DeleteMe" });

      // Dog must be gone from both repos
      const dogs = await dogRepo.find();
      expect(dogs).toHaveLength(0);

      const foundInRoot = await animalRepo.findOne({ id: dog.id });
      expect(foundInRoot).toBeNull();

      // Cat must remain
      const cats = await catRepo.find();
      expect(cats).toHaveLength(1);
    });

    test("updateMany on joined child repo only updates matching discriminator", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "Target", breed: "OldBreed" });
      await catRepo.insert({ kind: "cat", name: "Target", isIndoor: false });

      await dogRepo.updateMany({ name: "Target" }, { name: "Updated" });

      const dogs = await dogRepo.find();
      expect(dogs[0].name).toBe("Updated");

      // Cat with same name must be untouched
      const cats = await catRepo.find();
      expect(cats[0].name).toBe("Target");
    });

    test("updateMany can update child-specific fields on joined child", async () => {
      const dogRepo = getHandle().repository(TckDog);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "OldBreed" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "OldBreed" });
      await dogRepo.insert({ kind: "dog", name: "D3", breed: "KeepBreed" });

      await dogRepo.updateMany({ breed: "OldBreed" }, { breed: "NewBreed" });

      const updated = await dogRepo.find({ breed: "NewBreed" });
      expect(updated).toHaveLength(2);

      const unchanged = await dogRepo.find({ breed: "KeepBreed" });
      expect(unchanged).toHaveLength(1);
    });

    test("delete by child-specific field criteria on joined repo", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const animalRepo = getHandle().repository(TckAnimal);

      const dog1 = await dogRepo.insert({ kind: "dog", name: "D1", breed: "Mutt" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Labrador" });
      await dogRepo.insert({ kind: "dog", name: "D3", breed: "Mutt" });

      await dogRepo.delete({ breed: "Mutt" });

      const remaining = await dogRepo.find();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].breed).toBe("Labrador");

      // Deleted dogs must be gone from root repo too
      const rootResult = await animalRepo.findOne({ id: dog1.id });
      expect(rootResult).toBeNull();
    });

    // ─── Aggregate Operations (Joined) ────────────────────────────────

    test("sum on root repo operates across all joined subtypes", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Pug" });

      // version is a shared root field, all entities have version=1
      const versionSum = await animalRepo.sum("version");
      expect(versionSum).toBe(3);
    });

    test("count on root repo includes all joined subtypes", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      const total = await animalRepo.count();
      expect(total).toBe(2);
    });

    test("aggregate returns null for empty joined child repo", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const sum = await dogRepo.sum("version");
      expect(sum).toBeNull();

      const avg = await dogRepo.average("version");
      expect(avg).toBeNull();

      const min = await dogRepo.minimum("version");
      expect(min).toBeNull();

      const max = await dogRepo.maximum("version");
      expect(max).toBeNull();
    });

    test("sum on child repo respects discriminator filter", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Pug" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      // All entities have version=1; dog sum should be 2 (not 3)
      const total = await dogRepo.sum("version");
      expect(total).toBe(2);
    });

    test("average on child repo respects discriminator filter", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const d1 = await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      const d2 = await dogRepo.insert({ kind: "dog", name: "D2", breed: "Pug" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      // Update d1 twice to get version=3, d2 stays at version=1
      d1.breed = "Labrador";
      const d1v2 = await dogRepo.update(d1);
      d1v2.breed = "Lab Retriever";
      await dogRepo.update(d1v2);

      // Dog versions: 3 and 1 → average = 2
      const avg = await dogRepo.average("version");
      expect(avg).toBe(2);
    });

    test("minimum on child repo respects discriminator filter", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const d1 = await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Pug" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      // Update d1 to version=2, d2 stays at version=1
      d1.breed = "Labrador";
      await dogRepo.update(d1);

      const min = await dogRepo.minimum("version");
      expect(min).toBe(1);
    });

    test("maximum on child repo respects discriminator filter", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const d1 = await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Pug" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      // Update d1 to version=2, d2 stays at version=1
      d1.breed = "Labrador";
      await dogRepo.update(d1);

      const max = await dogRepo.maximum("version");
      expect(max).toBe(2);
    });

    test("sum with criteria on child repo filters before aggregating", async () => {
      const dogRepo = getHandle().repository(TckDog);

      await dogRepo.insert({ kind: "dog", name: "Target", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "Target", breed: "Pug" });
      await dogRepo.insert({ kind: "dog", name: "Other", breed: "Beagle" });

      // All version=1; only dogs named "Target" summed → 2
      const total = await dogRepo.sum("version", { name: "Target" });
      expect(total).toBe(2);
    });

    // ─── Advanced Query Operators (Joined) ────────────────────────────

    test("find with $in operator on shared field via joined child repo", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "Alpha", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "Beta", breed: "Pug" });
      await dogRepo.insert({ kind: "dog", name: "Gamma", breed: "Beagle" });
      await catRepo.insert({ kind: "cat", name: "Alpha", isIndoor: true });

      const results = await dogRepo.find(
        { name: { $in: ["Alpha", "Gamma"] } },
        { order: { name: "ASC" } },
      );
      // Only dogs — cat with "Alpha" excluded by discriminator
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Alpha");
      expect(results[1].name).toBe("Gamma");
    });

    test("find with $like operator on shared field via joined child repo", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "Rex the Great", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "Rex Junior", breed: "Pug" });
      await dogRepo.insert({ kind: "dog", name: "Max", breed: "Beagle" });
      await catRepo.insert({ kind: "cat", name: "Rex Whiskers", isIndoor: true });

      const results = await dogRepo.find(
        { name: { $like: "Rex%" } },
        { order: { name: "ASC" } },
      );
      // Only dogs matching — cat excluded by discriminator
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Rex Junior");
      expect(results[1].name).toBe("Rex the Great");
    });

    test("find with $gt operator on shared field via joined child repo", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const d1 = await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      const d2 = await dogRepo.insert({ kind: "dog", name: "D2", breed: "Pug" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      // Update d2 to bump version to 2
      d2.breed = "Beagle";
      await dogRepo.update(d2);

      const results = await dogRepo.find({ version: { $gt: 1 } });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("D2");
    });

    // ─── Ordering and Pagination (extended) ───────────────────────────

    test("find with limit and offset on joined child repo stays within discriminator", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "A", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "B", breed: "Pug" });
      await dogRepo.insert({ kind: "dog", name: "C", breed: "Beagle" });
      await catRepo.insert({ kind: "cat", name: "D", isIndoor: true });

      const page = await dogRepo.find(undefined, {
        limit: 2,
        offset: 1,
        order: { name: "ASC" },
      });

      expect(page).toHaveLength(2);
      expect(page[0].name).toBe("B");
      expect(page[1].name).toBe("C");
    });

    // ─── Root Repo findAndCount ───────────────────────────────────────

    test("root repo findAndCount returns all subtypes with correct total", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "Breed1" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Breed2" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      const [animals, count] = await animalRepo.findAndCount();
      expect(animals).toHaveLength(3);
      expect(count).toBe(3);
    });

    test("child repo findAndCount respects discriminator", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "Breed1" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Breed2" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      const [dogs, dogCount] = await dogRepo.findAndCount();
      expect(dogs).toHaveLength(2);
      expect(dogCount).toBe(2);
      expect(dogs.every((d) => d instanceof TckDog)).toBe(true);
    });

    test("child repo findAndCount with limit still returns total across all matching", async () => {
      const dogRepo = getHandle().repository(TckDog);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "B1" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "B2" });
      await dogRepo.insert({ kind: "dog", name: "D3", breed: "B3" });

      const [limited, total] = await dogRepo.findAndCount(undefined, {
        limit: 1,
        order: { name: "ASC" },
      });
      expect(limited).toHaveLength(1);
      expect(total).toBe(3);
    });

    // ─── Ordering and Pagination ──────────────────────────────────────

    test("ordered find on joined child repo respects discriminator", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      await dogRepo.insert({ kind: "dog", name: "Zara", breed: "Setter" });
      await dogRepo.insert({ kind: "dog", name: "Ace", breed: "Poodle" });
      await catRepo.insert({ kind: "cat", name: "Mia", isIndoor: true });

      const dogs = await dogRepo.find(undefined, { order: { name: "ASC" } });

      expect(dogs).toHaveLength(2);
      expect(dogs[0].name).toBe("Ace");
      expect(dogs[1].name).toBe("Zara");
    });

    // ─── findOneOrFail ────────────────────────────────────────────────

    test("findOneOrFail on joined child repo throws when entity belongs to different subtype", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Lab" });

      await expect(catRepo.findOneOrFail({ id: dog.id })).rejects.toThrow(
        ProteusRepositoryError,
      );
    });

    test("findOneOrFail on joined child repo succeeds for correct subtype", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Lab" });

      const found = await dogRepo.findOneOrFail({ id: dog.id });
      expect(found).toBeInstanceOf(TckDog);
      expect(found.name).toBe("Rex");
      expect(found.breed).toBe("Lab");
    });

    // ─── Edge Cases ───────────────────────────────────────────────────

    test("child-specific fields are undefined for other subtypes in root query", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Lab" });

      const animals = await animalRepo.find();
      expect(animals).toHaveLength(1);

      const entity = animals[0] as any;
      // The Dog entity should NOT have isIndoor (a Cat-specific field)
      expect(entity.isIndoor).toBeUndefined();
    });

    test("version increments on joined child update", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Lab" });
      expect(dog.version).toBe(1);

      dog.breed = "Labrador";
      const updated = await dogRepo.update(dog);
      expect(updated.version).toBe(2);
    });

    test("findOne for wrong type returns null on joined child repo", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Lab" });

      const found = await catRepo.findOne({ id: dog.id });
      expect(found).toBeNull();
    });

    test("root repo returns empty array when no entities", async () => {
      const animalRepo = getHandle().repository(TckAnimal);

      const results = await animalRepo.find();
      expect(results).toHaveLength(0);
    });

    test("child repo returns empty array when no matching discriminator rows", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      // Insert only cats
      await catRepo.insert({ kind: "cat", name: "OnlyCat", isIndoor: false });

      const dogs = await dogRepo.find();
      expect(dogs).toHaveLength(0);
    });

    test("exists returns false when no matching joined entities", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const result = await dogRepo.exists({ name: "Nobody" });
      expect(result).toBe(false);
    });

    test("exists on joined child repo returns false for sibling type entity", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);

      const cat = await catRepo.insert({ kind: "cat", name: "Sibling", isIndoor: true });

      // Looking for the cat's id in the dog repo must return false
      const result = await dogRepo.exists({ id: cat.id });
      expect(result).toBe(false);
    });

    test("instanceof checks on polymorphic joined results", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const animalRepo = getHandle().repository(TckAnimal);

      const dog = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Lab" });

      const results = await animalRepo.find({ id: dog.id });
      expect(results).toHaveLength(1);

      const entity = results[0];
      expect(entity instanceof TckDog).toBe(true);
      expect(entity instanceof TckAnimal).toBe(true);
      expect(entity instanceof TckCat).toBe(false);
    });

    test("optimistic lock conflict on stale joined child entity", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dog = await dogRepo.insert({ kind: "dog", name: "Fresh", breed: "Akita" });

      const stale = dogRepo.copy(dog);

      dog.breed = "Updated";
      await dogRepo.update(dog);

      stale.breed = "Stale";
      await expect(dogRepo.update(stale)).rejects.toThrow(ProteusError);
    });

    test("root repo find by discriminator value returns correct subtypes", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "D1", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "D2", breed: "Pug" });
      await catRepo.insert({ kind: "cat", name: "C1", isIndoor: true });

      const dogs = await animalRepo.find({ kind: "dog" });
      expect(dogs).toHaveLength(2);
      expect(dogs.every((a) => a instanceof TckDog)).toBe(true);
    });

    test("count on empty joined child repo returns zero", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const count = await dogRepo.count();
      expect(count).toBe(0);
    });

    test("boolean child-specific field survives round-trip", async () => {
      const catRepo = getHandle().repository(TckCat);

      const indoor = await catRepo.insert({
        kind: "cat",
        name: "Indoor",
        isIndoor: true,
      });
      const outdoor = await catRepo.insert({
        kind: "cat",
        name: "Outdoor",
        isIndoor: false,
      });

      const foundIndoor = await catRepo.findOne({ id: indoor.id });
      const foundOutdoor = await catRepo.findOne({ id: outdoor.id });

      expect(foundIndoor!.isIndoor).toBe(true);
      expect(foundOutdoor!.isIndoor).toBe(false);
    });

    // ─── Clear on Child ───────────────────────────────────────────────

    test("clear() on joined child removes only that child's rows, sibling rows intact", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const catRepo = getHandle().repository(TckCat);
      const animalRepo = getHandle().repository(TckAnimal);

      await dogRepo.insert({ kind: "dog", name: "ClearDog1", breed: "Lab" });
      await dogRepo.insert({ kind: "dog", name: "ClearDog2", breed: "Pug" });
      await catRepo.insert({ kind: "cat", name: "SurvivorCat", isIndoor: true });

      await dogRepo.clear();

      // All dogs must be gone
      const dogs = await dogRepo.find();
      expect(dogs).toHaveLength(0);

      // Cat must remain in cat repo
      const cats = await catRepo.find();
      expect(cats).toHaveLength(1);
      expect(cats[0].name).toBe("SurvivorCat");

      // Root repo must see only the surviving cat
      const all = await animalRepo.find();
      expect(all).toHaveLength(1);
      expect(all[0]).toBeInstanceOf(TckCat);
    });

    // ─── Save-Insert Path (upsert with new entity) ────────────────────

    test("save() with no id inserts new joined child with correct discriminator", async () => {
      const dogRepo = getHandle().repository(TckDog);
      const animalRepo = getHandle().repository(TckAnimal);

      const saved = await dogRepo.save({ kind: "dog", name: "SaveDog", breed: "Setter" });

      expect(saved.id).toBeDefined();
      expect(saved.kind).toBe("dog");
      expect(saved.breed).toBe("Setter");
      expect(saved).toBeInstanceOf(TckDog);
      expect(saved.version).toBe(1);

      // Re-fetch through root repo must still return TckDog
      const found = await animalRepo.findOne({ id: saved.id });
      expect(found).not.toBeNull();
      expect(found).toBeInstanceOf(TckDog);
      expect((found as any).breed).toBe("Setter");
    });

    // ─── insertMany: child-specific fields preserved ──────────────────

    test("insertMany on joined child persists all child-specific fields", async () => {
      const dogRepo = getHandle().repository(TckDog);

      const dogs = await dogRepo.insert([
        { kind: "dog", name: "BatchDog1", breed: "Labrador" },
        { kind: "dog", name: "BatchDog2", breed: "Poodle" },
        { kind: "dog", name: "BatchDog3", breed: "Beagle" },
      ]);

      expect(dogs).toHaveLength(3);

      // Refetch each by id and verify child-specific field is persisted
      for (const dog of dogs) {
        const found = await dogRepo.findOne({ id: dog.id });
        expect(found).not.toBeNull();
        expect(found!.breed).toBe(dog.breed);
        expect(found!.name).toBe(dog.name);
        expect(found!.kind).toBe("dog");
        expect(found).toBeInstanceOf(TckDog);
      }
    });

    // ─── QB write: joined children must throw ────────────────────────

    test("QB insert on joined child entity throws ProteusRepositoryError", async () => {
      const source = getSource();

      await expect(
        source
          .queryBuilder(TckDog)
          .insert()
          .values([{ name: "QB Dog", breed: "Lab" } as any])
          .execute(),
      ).rejects.toThrow(ProteusRepositoryError);
    });

    test("QB update on joined child entity throws ProteusRepositoryError", async () => {
      const source = getSource();
      const dogRepo = getHandle().repository(TckDog);

      await dogRepo.insert({ kind: "dog", name: "Existing", breed: "Lab" });

      await expect(
        source
          .queryBuilder(TckDog)
          .update()
          .set({ name: "Updated" })
          .where({ name: "Existing" })
          .execute(),
      ).rejects.toThrow(ProteusRepositoryError);
    });

    test("QB delete on joined child entity throws ProteusRepositoryError", async () => {
      const source = getSource();
      const dogRepo = getHandle().repository(TckDog);

      await dogRepo.insert({ kind: "dog", name: "ToDelete", breed: "Pug" });

      await expect(
        source.queryBuilder(TckDog).delete().where({ name: "ToDelete" }).execute(),
      ).rejects.toThrow(ProteusRepositoryError);
    });
  });
};
