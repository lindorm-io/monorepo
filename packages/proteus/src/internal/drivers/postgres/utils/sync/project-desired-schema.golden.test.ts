import { describe, expect, test } from "vitest";
import {
  AppendOnly,
  Cascade,
  Check,
  Default,
  Deferrable,
  Discriminator,
  DiscriminatorValue,
  Embeddable,
  EmbeddedList,
  Encrypted,
  Entity,
  Enum,
  Field,
  Generated,
  Index,
  Inheritance,
  JoinTable,
  ManyToMany,
  ManyToOne,
  Nullable,
  OneToMany,
  PrimaryKeyField,
  TypedJson,
  Unique,
} from "../../../../../decorators/index.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { resolveInheritanceHierarchies } from "../../../../entity/metadata/resolve-inheritance.js";
import { projectDesiredSchema } from "./project-desired-schema.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────
//
// Golden fixture set locking the riskiest projection paths: joined/single-table
// inheritance (constraint ordering, discriminator index), M2M join tables,
// embedded lists (embeddable + primitive collection tables), append-only trigger
// grouping, named enums, opclass/sparse indexes, deferrable relations, literal
// defaults, encrypted fields, typedJson sidecar columns, and namespacing.

enum PgGoldStatus {
  Active = "active",
  Archived = "archived",
}

@Inheritance("joined")
@Discriminator("kind")
@Entity({ name: "PgGoldAnimal" })
class PgGoldAnimal {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  kind!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "PgGoldDog" })
@DiscriminatorValue("dog")
@Unique<typeof PgGoldDog>(["breed"], { name: "unique_pg_gold_dog_breed" })
@Check("length(breed) > 0", { name: "pg_gold_dog_breed_not_empty" })
class PgGoldDog extends PgGoldAnimal {
  @Field("string")
  breed!: string;
}

@Inheritance("single-table")
@Discriminator("kind")
@Entity({ name: "PgGoldVehicle" })
class PgGoldVehicle {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  kind!: string;

  @Field("string")
  make!: string;
}

@Entity({ name: "PgGoldCar" })
@DiscriminatorValue("car")
class PgGoldCar extends PgGoldVehicle {
  @Nullable()
  @Field("integer")
  seatCount!: number | null;
}

@Entity({ name: "PgGoldTruck" })
@DiscriminatorValue("truck")
class PgGoldTruck extends PgGoldVehicle {
  @Nullable()
  @Field("float")
  payloadCapacity!: number | null;
}

@Entity({ name: "PgGoldCourse" })
class PgGoldCourse {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => PgGoldStudent, "courses")
  students!: PgGoldStudent[];
}

@Entity({ name: "PgGoldStudent" })
class PgGoldStudent {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => PgGoldCourse, "students")
  courses!: PgGoldCourse[];
}

@Embeddable()
class PgGoldAddress {
  @Field("string")
  street!: string;

  @Nullable()
  @Field("string")
  zip!: string | null;

  @Enum(PgGoldStatus)
  @Field("enum")
  status!: PgGoldStatus;
}

@Entity({ name: "PgGoldUser" })
class PgGoldUser {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @EmbeddedList("string")
  tags!: string[];

  @EmbeddedList(() => PgGoldAddress)
  addresses!: PgGoldAddress[];
}

@AppendOnly()
@Entity({ name: "PgGoldLedger" })
class PgGoldLedger {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  event!: string;
}

@Entity({ name: "PgGoldOwner" })
class PgGoldOwner {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @OneToMany(() => PgGoldKitchen, "owner")
  items!: PgGoldKitchen[];
}

@Entity({ name: "PgGoldKitchen" })
class PgGoldKitchen {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Enum(PgGoldStatus)
  @Field("enum")
  status!: PgGoldStatus;

  @Enum(PgGoldStatus)
  @Field("enum", { name: "state_col" })
  state!: PgGoldStatus;

  @Index("asc", { name: "pg_gold_kitchen_trgm", using: "gin", opclass: "gin_trgm_ops" })
  @Field("string")
  searchText!: string;

  @Index("asc", { sparse: true })
  @Nullable()
  @Field("string")
  region!: string | null;

  @Default(true)
  @Field("boolean")
  isActive!: boolean;

  @Default("draft")
  @Field("string")
  stage!: string;

  @Default(42)
  @Field("integer")
  priority!: number;

  @Encrypted()
  @Field("string")
  secret!: string;

  @TypedJson()
  @Field("json")
  payload!: unknown;

  @Deferrable({ initially: true })
  @Cascade({ onDestroy: "set_null", onUpdate: "cascade" })
  @ManyToOne(() => PgGoldOwner, "items")
  owner!: PgGoldOwner | null;
}

@Entity({ name: "PgGoldScoped" })
class PgGoldScoped {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Enum(PgGoldStatus)
  @Field("enum")
  status!: PgGoldStatus;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("projectDesiredSchema (golden)", () => {
  test("projects joined inheritance with inheritance FK ordered before uniques and checks", () => {
    const entities = [PgGoldAnimal, PgGoldDog];
    const inheritanceMap = resolveInheritanceHierarchies(entities);
    const schema = projectDesiredSchema(
      entities.map((e) => getEntityMetadata(e, inheritanceMap)),
      {},
    );

    expect(schema.tables).toHaveLength(2);
    const child = schema.tables.find((t) => t.name === "PgGoldDog");
    expect(child).toBeDefined();
    // Constraint ordering is load-bearing: PK, inheritance FK, uniques, checks.
    expect(child!.constraints.map((c) => c.type)).toEqual([
      "PRIMARY KEY",
      "FOREIGN KEY",
      "UNIQUE",
      "CHECK",
    ]);
    expect(schema).toMatchSnapshot();
  });

  test("projects single-table inheritance with discriminator index on the root table", () => {
    const entities = [PgGoldVehicle, PgGoldCar, PgGoldTruck];
    const inheritanceMap = resolveInheritanceHierarchies(entities);
    const schema = projectDesiredSchema(
      entities.map((e) => getEntityMetadata(e, inheritanceMap)),
      {},
    );

    expect(schema.tables).toHaveLength(1);
    expect(
      schema.tables[0].indexes.some(
        (i) => i.columns.length === 1 && i.columns[0].name === "kind",
      ),
    ).toBe(true);
    expect(schema).toMatchSnapshot();
  });

  test("projects ManyToMany join table", () => {
    const schema = projectDesiredSchema(
      [getEntityMetadata(PgGoldCourse), getEntityMetadata(PgGoldStudent)],
      {},
    );

    const joinTable = schema.tables.find(
      (t) => t.name !== "PgGoldCourse" && t.name !== "PgGoldStudent",
    );
    expect(joinTable).toBeDefined();
    expect(
      joinTable!.constraints.filter((c) => c.type === "FOREIGN KEY").length,
    ).toBeGreaterThanOrEqual(2);
    expect(schema).toMatchSnapshot();
  });

  test("projects embedded lists into collection tables with (parentFk, __ordinal) primary keys", () => {
    const schema = projectDesiredSchema([getEntityMetadata(PgGoldUser)], {});

    const collectionTables = schema.tables.filter((t) => t.name !== "PgGoldUser");
    expect(collectionTables).toHaveLength(2);
    // Collection tables carry a composite PK (parentFk, __ordinal) — pg drift
    // fixed 2026-07-11; mysql/sqlite always declared it.
    for (const table of collectionTables) {
      const pk = table.constraints.find((c) => c.type === "PRIMARY KEY");
      expect(pk?.columns).toEqual([expect.stringMatching(/_id$/), "__ordinal"]);
    }
    expect(schema).toMatchSnapshot();
  });

  test("projects append-only triggers with guard function grouped into the first trigger", () => {
    const schema = projectDesiredSchema([getEntityMetadata(PgGoldLedger)], {});

    const triggers = schema.tables[0].triggers;
    expect(triggers).toHaveLength(3);
    // First trigger carries the shared guard function + drop + create.
    expect(triggers[0].statements).toHaveLength(3);
    expect(triggers[1].statements).toHaveLength(2);
    expect(triggers[2].statements).toHaveLength(2);
    expect(schema).toMatchSnapshot();
  });

  test("projects named enums, opclass and sparse indexes, deferrable relation, defaults, encrypted and typedJson fields", () => {
    const schema = projectDesiredSchema(
      [getEntityMetadata(PgGoldOwner), getEntityMetadata(PgGoldKitchen)],
      {},
    );

    expect(schema.extensions).toContain("pg_trgm");
    const kitchen = schema.tables.find((t) => t.name === "PgGoldKitchen");
    expect(kitchen).toBeDefined();
    expect(kitchen!.columns.some((c) => c.name === "payload__typemeta")).toBe(true);
    expect(schema).toMatchSnapshot();
  });

  test("projects namespaced entities with schema-qualified tables and enums", () => {
    const schema = projectDesiredSchema([getEntityMetadata(PgGoldScoped)], {
      namespace: "analytics",
    });

    expect(schema.schemas).toContain("analytics");
    expect(schema.tables[0].schema).toBe("analytics");
    expect(schema.enums[0].schema).toBe("analytics");
    expect(schema).toMatchSnapshot();
  });
});
