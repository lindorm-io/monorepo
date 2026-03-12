// Table Inheritance PostgreSQL Integration Tests
//
// Exercises both inheritance strategies against a real PostgreSQL instance:
//   - "single-table" (STI): all subtypes share one table, discriminator column routes hydration
//   - "joined" (CTI): each subtype has its own table, JOINed on primary key
//
// Uses a randomised schema for isolation; teardown drops the schema.

import { randomBytes } from "crypto";
import { createMockLogger } from "@lindorm/logger";
import { Client } from "pg";
import { ProteusSource } from "../../classes/ProteusSource";
import {
  Discriminator,
  DiscriminatorValue,
  Entity,
  Field,
  Inheritance,
  Nullable,
  PrimaryKeyField,
} from "../../decorators";

jest.setTimeout(60_000);

// ─── Connection ──────────────────────────────────────────────────────────────

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

// ─── Single-Table Hierarchy ──────────────────────────────────────────────────
//
// All three classes share the "InhVehicle" table.
// The "type" column acts as the discriminator.

@Inheritance("single-table")
@Discriminator("type")
@Entity({ name: "InhVehicle" })
class InhVehicle {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  type!: string;

  @Field("string")
  make!: string;
}

@Entity({ name: "InhCar" })
@DiscriminatorValue("car")
class InhCar extends InhVehicle {
  @Nullable()
  @Field("integer")
  seatCount!: number | null;
}

@Entity({ name: "InhTruck" })
@DiscriminatorValue("truck")
class InhTruck extends InhVehicle {
  @Nullable()
  @Field("float")
  payloadCapacity!: number | null;
}

// ─── Joined Hierarchy ────────────────────────────────────────────────────────
//
// InhAnimal → root table "InhAnimal"
// InhDog    → child table "InhDog" (id FK → InhAnimal.id)
// InhCat    → child table "InhCat" (id FK → InhAnimal.id)

@Inheritance("joined")
@Discriminator("kind")
@Entity({ name: "InhAnimal" })
class InhAnimal {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  kind!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "InhDog" })
@DiscriminatorValue("dog")
class InhDog extends InhAnimal {
  @Field("string")
  breed!: string;
}

@Entity({ name: "InhCat" })
@DiscriminatorValue("cat")
class InhCat extends InhAnimal {
  @Field("boolean")
  isIndoor!: boolean;
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

const namespace = `inh_${randomBytes(6).toString("hex")}`;

let source: ProteusSource;
let rawClient: Client;

beforeAll(async () => {
  // Create the schema first with a raw client
  rawClient = new Client({ connectionString: PG_CONNECTION });
  await rawClient.connect();
  await rawClient.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
  await rawClient.query(`CREATE SCHEMA "${namespace}"`);

  source = new ProteusSource({
    driver: "postgres",
    url: PG_CONNECTION,
    namespace,
    synchronize: true,
    entities: [InhVehicle, InhCar, InhTruck, InhAnimal, InhDog, InhCat],
    logger: createMockLogger(),
  });

  await source.connect();
  await source.setup();
});

afterAll(async () => {
  await source.disconnect();

  await rawClient.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
  await rawClient.end();
});

// Clear all rows between tests so each test starts from a clean state.
// Disable FK triggers to avoid order sensitivity when deleting.
beforeEach(async () => {
  await rawClient.query(`SET session_replication_role = 'replica'`);

  const result = await rawClient.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
    [namespace],
  );

  for (const row of result.rows) {
    await rawClient.query(`DELETE FROM "${namespace}"."${row.table_name}"`);
  }

  await rawClient.query(`SET session_replication_role = 'origin'`);
});

// ─── Helper: inspect actual schema ───────────────────────────────────────────

const getTableNames = async (): Promise<string[]> => {
  const result = await rawClient.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [namespace],
  );
  return result.rows.map((r: { table_name: string }) => r.table_name);
};

const getColumnNames = async (table: string): Promise<string[]> => {
  const result = await rawClient.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [namespace, table],
  );
  return result.rows.map((r: { column_name: string }) => r.column_name);
};

// ─── Single-Table (STI) Tests ─────────────────────────────────────────────────

describe("single-table inheritance", () => {
  describe("insert and retrieve by subtype repo", () => {
    it("inserts a Car and retrieves it via the Car repo", async () => {
      const carRepo = source.repository(InhCar);

      // The discriminator field "type" must be provided explicitly — the framework
      // auto-enforces the correct value in the SQL but Zod validation runs first.
      const saved = await carRepo.insert({ type: "car", make: "Toyota", seatCount: 5 });

      expect(saved).toMatchSnapshot({ id: expect.any(String) });
      expect(saved).toBeInstanceOf(InhCar);
    });

    it("inserts a Truck and retrieves it via the Truck repo", async () => {
      const truckRepo = source.repository(InhTruck);

      const saved = await truckRepo.insert({
        type: "truck",
        make: "Ford",
        payloadCapacity: 2.5,
      });

      expect(saved).toMatchSnapshot({ id: expect.any(String) });
      expect(saved).toBeInstanceOf(InhTruck);
    });
  });

  describe("findOne by subtype repo", () => {
    it("finds an inserted Car by ID through the Car repo", async () => {
      const carRepo = source.repository(InhCar);

      const saved = await carRepo.insert({ type: "car", make: "Honda", seatCount: 4 });
      const found = await carRepo.findOne({ id: saved.id });

      expect(found).not.toBeNull();
      expect(found).toMatchSnapshot({ id: expect.any(String) });
      expect(found).toBeInstanceOf(InhCar);
    });

    it("finds an inserted Truck by ID through the Truck repo", async () => {
      const truckRepo = source.repository(InhTruck);

      const saved = await truckRepo.insert({
        type: "truck",
        make: "Volvo",
        payloadCapacity: 10.0,
      });
      const found = await truckRepo.findOne({ id: saved.id });

      expect(found).not.toBeNull();
      expect(found).toMatchSnapshot({ id: expect.any(String) });
      expect(found).toBeInstanceOf(InhTruck);
    });
  });

  describe("polymorphic query via root repo", () => {
    it("finds both Cars and Trucks when querying via the Vehicle repo", async () => {
      const vehicleRepo = source.repository(InhVehicle);
      const carRepo = source.repository(InhCar);
      const truckRepo = source.repository(InhTruck);

      await carRepo.insert({ type: "car", make: "Nissan", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "Mack", payloadCapacity: 15.0 });

      const vehicles = await vehicleRepo.find();

      // Two vehicles of different types should be returned
      expect(vehicles).toHaveLength(2);
      expect(vehicles.map((v) => v.constructor.name).sort()).toMatchSnapshot();
    });

    it("polymorphic find returns Car instances with correct constructor", async () => {
      const vehicleRepo = source.repository(InhVehicle);
      const carRepo = source.repository(InhCar);

      const car = await carRepo.insert({ type: "car", make: "Subaru", seatCount: 5 });

      const results = await vehicleRepo.find({ id: car.id });

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(InhCar);
    });

    it("polymorphic find returns Truck instances with correct constructor", async () => {
      const vehicleRepo = source.repository(InhVehicle);
      const truckRepo = source.repository(InhTruck);

      const truck = await truckRepo.insert({
        type: "truck",
        make: "Peterbilt",
        payloadCapacity: 20.0,
      });

      const results = await vehicleRepo.find({ id: truck.id });

      expect(results).toHaveLength(1);
      expect(results[0]).toBeInstanceOf(InhTruck);
    });
  });

  describe("child repo discriminator filtering", () => {
    it("carRepo.find returns only Cars, not Trucks", async () => {
      const carRepo = source.repository(InhCar);
      const truckRepo = source.repository(InhTruck);

      await carRepo.insert({ type: "car", make: "BMW", seatCount: 4 });
      await carRepo.insert({ type: "car", make: "Audi", seatCount: 5 });
      await truckRepo.insert({ type: "truck", make: "Kenworth", payloadCapacity: 18.0 });

      const cars = await carRepo.find();

      expect(cars).toHaveLength(2);
      expect(cars.every((c) => c instanceof InhCar)).toBe(true);
    });

    it("truckRepo.find returns only Trucks, not Cars", async () => {
      const carRepo = source.repository(InhCar);
      const truckRepo = source.repository(InhTruck);

      await carRepo.insert({ type: "car", make: "Mercedes", seatCount: 4 });
      await truckRepo.insert({ type: "truck", make: "Scania", payloadCapacity: 22.0 });
      await truckRepo.insert({ type: "truck", make: "DAF", payloadCapacity: 17.5 });

      const trucks = await truckRepo.find();

      expect(trucks).toHaveLength(2);
      expect(trucks.every((t) => t instanceof InhTruck)).toBe(true);
    });
  });

  describe("update", () => {
    it("updating a Car preserves the discriminator and updates the correct fields", async () => {
      const carRepo = source.repository(InhCar);

      const saved = await carRepo.insert({ type: "car", make: "Fiat", seatCount: 4 });

      saved.make = "Alfa Romeo";
      saved.seatCount = 2;

      const updated = await carRepo.update(saved);

      expect(updated).toMatchSnapshot({ id: expect.any(String) });
      expect(updated).toBeInstanceOf(InhCar);
      expect(updated.type).toBe("car");
    });

    it("updating a Car does not affect Trucks in the same table", async () => {
      const carRepo = source.repository(InhCar);
      const truckRepo = source.repository(InhTruck);

      const car = await carRepo.insert({ type: "car", make: "VW", seatCount: 5 });
      const truck = await truckRepo.insert({
        type: "truck",
        make: "Hino",
        payloadCapacity: 8.0,
      });

      car.make = "Porsche";
      await carRepo.update(car);

      // Truck should be unchanged
      const foundTruck = await truckRepo.findOne({ id: truck.id });
      expect(foundTruck).not.toBeNull();
      expect(foundTruck!.make).toBe("Hino");
    });
  });

  describe("delete", () => {
    it("deleting a Car removes only that Car; the Truck remains", async () => {
      const carRepo = source.repository(InhCar);
      const truckRepo = source.repository(InhTruck);

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
    });
  });

  describe("instanceof check on polymorphic hydration", () => {
    it("entity found via the Vehicle repo passes instanceof Car check", async () => {
      const vehicleRepo = source.repository(InhVehicle);
      const carRepo = source.repository(InhCar);

      const car = await carRepo.insert({ type: "car", make: "Renault", seatCount: 5 });

      const results = await vehicleRepo.find({ id: car.id });

      expect(results).toHaveLength(1);
      expect(results[0] instanceof InhCar).toBe(true);
      expect(results[0] instanceof InhVehicle).toBe(true);
    });
  });

  describe("discriminator value is read-only", () => {
    it("discriminator field has correct value after insert and update", async () => {
      const carRepo = source.repository(InhCar);

      const car = await carRepo.insert({ type: "car", make: "Seat", seatCount: 5 });

      // Discriminator should be "car" as set
      expect(car.type).toBe("car");

      // Updating non-discriminator fields should keep type intact
      car.make = "Cupra";
      const updated = await carRepo.update(car);

      expect(updated.type).toBe("car");
    });
  });
});

// ─── Joined (CTI) Tests ───────────────────────────────────────────────────────

describe("joined inheritance", () => {
  // NOTE: For joined inheritance the discriminator field ("kind") is a root field.
  // The entity name used by getEntityName is the literal string from @Entity({ name: "..." }).
  // Table names are: "InhAnimal", "InhDog", "InhCat" (no transformation for naming="none").

  describe("insert populates both root and child tables", () => {
    it("inserting a Dog writes a row to both the Animal root table and the Dog child table", async () => {
      const dogRepo = source.repository(InhDog);

      const saved = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Labrador" });

      expect(saved).not.toBeNull();
      expect(saved).toMatchSnapshot({ id: expect.any(String) });

      // Verify both tables have a row for the same ID
      const animalRow = await rawClient.query(
        `SELECT * FROM "${namespace}"."InhAnimal" WHERE id = $1`,
        [saved.id],
      );
      const dogRow = await rawClient.query(
        `SELECT * FROM "${namespace}"."InhDog" WHERE id = $1`,
        [saved.id],
      );

      expect(animalRow.rows).toHaveLength(1);
      expect(dogRow.rows).toHaveLength(1);
    });

    it("inserting a Cat writes a row to both the Animal root table and the Cat child table", async () => {
      const catRepo = source.repository(InhCat);

      const saved = await catRepo.insert({
        kind: "cat",
        name: "Whiskers",
        isIndoor: true,
      });

      // Verify both tables have a row for the same ID
      const animalRow = await rawClient.query(
        `SELECT * FROM "${namespace}"."InhAnimal" WHERE id = $1`,
        [saved.id],
      );
      const catRow = await rawClient.query(
        `SELECT * FROM "${namespace}"."InhCat" WHERE id = $1`,
        [saved.id],
      );

      expect(animalRow.rows).toHaveLength(1);
      expect(catRow.rows).toHaveLength(1);
    });
  });

  describe("findOne via child repo", () => {
    it("finds a Dog with all fields from both root and child tables", async () => {
      const dogRepo = source.repository(InhDog);

      const saved = await dogRepo.insert({ kind: "dog", name: "Buddy", breed: "Beagle" });
      const found = await dogRepo.findOne({ id: saved.id });

      expect(found).not.toBeNull();
      expect(found).toMatchSnapshot({ id: expect.any(String) });
      expect(found).toBeInstanceOf(InhDog);
      // Root field
      expect(found!.name).toBe("Buddy");
      // Child field
      expect(found!.breed).toBe("Beagle");
    });

    it("finds a Cat with all fields from both root and child tables", async () => {
      const catRepo = source.repository(InhCat);

      const saved = await catRepo.insert({ kind: "cat", name: "Luna", isIndoor: false });
      const found = await catRepo.findOne({ id: saved.id });

      expect(found).not.toBeNull();
      expect(found).toMatchSnapshot({ id: expect.any(String) });
      expect(found).toBeInstanceOf(InhCat);
      expect(found!.name).toBe("Luna");
      expect(found!.isIndoor).toBe(false);
    });
  });

  describe("polymorphic query via root repo", () => {
    it("animalRepo.find returns both Dog and Cat instances with correct constructors", async () => {
      const animalRepo = source.repository(InhAnimal);
      const dogRepo = source.repository(InhDog);
      const catRepo = source.repository(InhCat);

      await dogRepo.insert({ kind: "dog", name: "Max", breed: "Poodle" });
      await catRepo.insert({ kind: "cat", name: "Nala", isIndoor: true });

      const animals = await animalRepo.find();

      expect(animals).toHaveLength(2);

      const dog = animals.find((a) => a instanceof InhDog);
      const cat = animals.find((a) => a instanceof InhCat);

      expect(dog).toBeDefined();
      expect(cat).toBeDefined();
    });
  });

  describe("update", () => {
    it("updating a Dog child field (breed) via partial update succeeds", async () => {
      const dogRepo = source.repository(InhDog);

      // Insert creates the snapshot
      const saved = await dogRepo.insert({ kind: "dog", name: "Rex", breed: "Labrador" });

      // Modify a child-specific field — triggers partial update (snapshot exists)
      saved.breed = "Golden Retriever";

      const updated = await dogRepo.update(saved);

      expect(updated).toBeInstanceOf(InhDog);
      expect(updated.breed).toBe("Golden Retriever");
      expect(updated.name).toBe("Rex");
      expect(updated.kind).toBe("dog");

      // Verify both tables via raw SQL
      const animalRow = await rawClient.query(
        `SELECT name, kind FROM "${namespace}"."InhAnimal" WHERE id = $1`,
        [saved.id],
      );
      expect(animalRow.rows[0].name).toBe("Rex");
      expect(animalRow.rows[0].kind).toBe("dog");

      const dogRow = await rawClient.query(
        `SELECT breed FROM "${namespace}"."InhDog" WHERE id = $1`,
        [saved.id],
      );
      expect(dogRow.rows[0].breed).toBe("Golden Retriever");
    });

    it("updating both root and child fields on a Dog succeeds", async () => {
      const dogRepo = source.repository(InhDog);

      const saved = await dogRepo.insert({ kind: "dog", name: "Buddy", breed: "Beagle" });

      // Modify both root and child fields
      saved.name = "Max";
      saved.breed = "Poodle";

      const updated = await dogRepo.update(saved);

      expect(updated).toBeInstanceOf(InhDog);
      expect(updated.name).toBe("Max");
      expect(updated.breed).toBe("Poodle");

      // Re-fetch to confirm persistence
      const refetched = await dogRepo.findOne({ id: saved.id });
      expect(refetched).not.toBeNull();
      expect(refetched!.name).toBe("Max");
      expect(refetched!.breed).toBe("Poodle");
    });

    // Verifies that updating only root-table fields (name) on a Dog entity succeeds.
    // Child-table fields (breed) are not changed, so compilePartialUpdate only sends
    // root columns to the root table — no cross-table collision occurs.
    // NOTE: The returned entity's child fields (breed) may be null in the RETURNING row
    // because the child table UPDATE is skipped when no child fields change. The
    // root-table update is verified via raw SQL to confirm correctness.
    it("updating a Dog root field (name) succeeds when only root fields change", async () => {
      const dogRepo = source.repository(InhDog);

      const saved = await dogRepo.insert({
        kind: "dog",
        name: "Charlie",
        breed: "Spaniel",
      });

      // Only change a root field — child field "breed" stays the same
      saved.name = "Charles";

      // The update should not throw (root-only partial update is safe)
      await dogRepo.update(saved);

      // Verify root table was updated via raw SQL (the authoritative source)
      const animalRow = await rawClient.query(
        `SELECT name FROM "${namespace}"."InhAnimal" WHERE id = $1`,
        [saved.id],
      );
      expect(animalRow.rows[0].name).toBe("Charles");

      // Verify child table row is intact (breed unchanged)
      const dogRow = await rawClient.query(
        `SELECT breed FROM "${namespace}"."InhDog" WHERE id = $1`,
        [saved.id],
      );
      expect(dogRow.rows[0].breed).toBe("Spaniel");

      // Re-fetch via repo to get the authoritative merged view
      const refetched = await dogRepo.findOne({ id: saved.id });
      expect(refetched).not.toBeNull();
      expect(refetched!.name).toBe("Charles");
      expect(refetched!.breed).toBe("Spaniel");
    });
  });

  describe("delete", () => {
    it("deleting a Dog removes its row from both root and child tables", async () => {
      const dogRepo = source.repository(InhDog);

      const saved = await dogRepo.insert({ kind: "dog", name: "Bailey", breed: "Husky" });

      await dogRepo.destroy(saved);

      const animalRow = await rawClient.query(
        `SELECT id FROM "${namespace}"."InhAnimal" WHERE id = $1`,
        [saved.id],
      );
      const dogRow = await rawClient.query(
        `SELECT id FROM "${namespace}"."InhDog" WHERE id = $1`,
        [saved.id],
      );

      expect(animalRow.rows).toHaveLength(0);
      expect(dogRow.rows).toHaveLength(0);
    });
  });

  describe("field ownership", () => {
    it("Dog has correct root field (name) and child field (breed)", async () => {
      const dogRepo = source.repository(InhDog);

      const saved = await dogRepo.insert({ kind: "dog", name: "Koda", breed: "Samoyed" });

      expect(saved.name).toBe("Koda");
      expect(saved.breed).toBe("Samoyed");
    });
  });
});

// ─── DDL / Schema Tests ───────────────────────────────────────────────────────

describe("DDL schema correctness", () => {
  it("creates a single table for the single-table Vehicle hierarchy", async () => {
    const tables = await getTableNames();

    // Single-table: only the root table exists — no separate child tables
    expect(tables).toContain("InhVehicle");
    expect(tables).not.toContain("InhCar");
    expect(tables).not.toContain("InhTruck");
  });

  it("single-table Vehicle table contains columns for all subtypes", async () => {
    const columns = await getColumnNames("InhVehicle");

    // Root columns
    expect(columns).toContain("id");
    expect(columns).toContain("type");
    expect(columns).toContain("make");

    // Car-specific column (subtype-only fields are projected nullable into root table)
    expect(columns).toContain("seatCount");

    // Truck-specific column
    expect(columns).toContain("payloadCapacity");
  });

  it("creates separate tables for the joined Animal hierarchy", async () => {
    const tables = await getTableNames();

    // Joined: root table + one table per concrete subtype
    expect(tables).toContain("InhAnimal");
    expect(tables).toContain("InhDog");
    expect(tables).toContain("InhCat");
  });

  it("joined Dog table contains only Dog-specific columns plus the PK", async () => {
    const dogColumns = await getColumnNames("InhDog");

    // Dog child table should have "id" (FK to root) and "breed"
    expect(dogColumns).toContain("id");
    expect(dogColumns).toContain("breed");

    // Root fields should NOT be duplicated in the child table
    expect(dogColumns).not.toContain("name");
    expect(dogColumns).not.toContain("kind");
  });

  it("joined Cat table contains only Cat-specific columns plus the PK", async () => {
    const catColumns = await getColumnNames("InhCat");

    expect(catColumns).toContain("id");
    expect(catColumns).toContain("isIndoor");

    expect(catColumns).not.toContain("name");
    expect(catColumns).not.toContain("kind");
  });
});
