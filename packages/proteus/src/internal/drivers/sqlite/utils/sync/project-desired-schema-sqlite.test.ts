import { describe, expect, test } from "vitest";
import {
  AppendOnly,
  Cascade,
  Check,
  Computed,
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
  PrimaryKey,
  PrimaryKeyField,
  TypedJson,
  Unique,
} from "../../../../../decorators/index.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { resolveInheritanceHierarchies } from "../../../../entity/metadata/resolve-inheritance.js";
import { projectDesiredSchemaSqlite } from "./project-desired-schema-sqlite.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────
//
// Rich fixture set exercising the full projection surface: enums, computed
// columns, defaults, embedded lists (primitive + embeddable), relations with
// deferrable/cascade options, both inheritance strategies, M2M join
// tables, append-only triggers, indexes (incl. sparse), uniques, and checks.

enum GoldStatus {
  Active = "active",
  Archived = "archived",
}

@Embeddable()
class GoldAddress {
  @Field("string")
  street!: string;

  @Nullable()
  @Field("string")
  zip!: string | null;

  @Enum(GoldStatus)
  @Field("enum")
  status!: GoldStatus;
}

@Entity({ name: "GoldUser" })
class GoldUser {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  firstName!: string;

  @Field("string")
  lastName!: string;

  @Nullable()
  @Field("string")
  email!: string | null;

  @Default(0)
  @Field("integer")
  age!: number;

  @Enum(GoldStatus)
  @Field("enum")
  status!: GoldStatus;

  @Computed("first_name || ' ' || last_name")
  @Field("string")
  displayName!: string;

  @EmbeddedList("string")
  tags!: string[];

  @EmbeddedList(() => GoldAddress)
  addresses!: GoldAddress[];

  @OneToMany(() => GoldPost, "author")
  posts!: GoldPost[];
}

@Entity({ name: "GoldPost" })
class GoldPost {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  @Field("string")
  title!: string;

  @Deferrable({ initially: true })
  @Cascade({ onDestroy: "set_null", onUpdate: "cascade" })
  @ManyToOne(() => GoldUser, "posts")
  author!: GoldUser | null;
}

@Inheritance("single-table")
@Discriminator("kind")
@Entity({ name: "GoldVehicle" })
class GoldVehicle {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  kind!: string;

  @Field("string")
  make!: string;
}

@Entity({ name: "GoldCar" })
@DiscriminatorValue("car")
class GoldCar extends GoldVehicle {
  @Nullable()
  @Field("integer")
  seatCount!: number | null;
}

@Entity({ name: "GoldTruck" })
@DiscriminatorValue("truck")
class GoldTruck extends GoldVehicle {
  @Nullable()
  @Field("float")
  payloadCapacity!: number | null;
}

@Inheritance("joined")
@Discriminator("kind")
@Entity({ name: "GoldAnimal" })
class GoldAnimal {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  kind!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "GoldDog" })
@DiscriminatorValue("dog")
class GoldDog extends GoldAnimal {
  @Field("string")
  breed!: string;
}

@Entity({ name: "GoldCat" })
@DiscriminatorValue("cat")
class GoldCat extends GoldAnimal {
  @Field("boolean")
  isIndoor!: boolean;
}

@Entity({ name: "GoldCourse" })
class GoldCourse {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @JoinTable()
  @ManyToMany(() => GoldStudent, "courses")
  students!: GoldStudent[];
}

@Entity({ name: "GoldStudent" })
class GoldStudent {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => GoldCourse, "students")
  courses!: GoldCourse[];
}

@AppendOnly()
@Entity({ name: "GoldLedger" })
class GoldLedger {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  event!: string;
}

@Entity({ name: "GoldIndexed" })
@Index<typeof GoldIndexed>(["email", "name"])
@Unique<typeof GoldIndexed>(["email"], { name: "unique_gold_email" })
class GoldIndexed {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Index("asc", { name: "gold_idx_name" })
  @Field("string")
  name!: string;

  @Field("string")
  email!: string;

  @Index("asc", { sparse: true })
  @Nullable()
  @Field("string")
  region!: string | null;
}

@Entity({ name: "GoldChecked" })
@Check("age >= 0", { name: "gold_age_positive" })
@Check("score BETWEEN 0 AND 100")
class GoldChecked {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("integer")
  age!: number;

  @Field("float")
  score!: number;
}

@Entity({ name: "GoldFlags" })
class GoldFlags {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Default(true)
  @Field("boolean")
  isActive!: boolean;

  @Default(false)
  @Field("boolean")
  isArchived!: boolean;
}

@Entity({ name: "GoldSecret" })
class GoldSecret {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Encrypted()
  @Field("string")
  secret!: string;

  @Encrypted()
  @Enum(GoldStatus)
  @Field("enum")
  status!: GoldStatus;
}

@Entity({ name: "GoldTyped" })
class GoldTyped {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @TypedJson()
  @Field("json")
  payload!: unknown;
}

@Entity({ name: "GoldIdentity" })
class GoldIdentity {
  @PrimaryKey()
  @Field("integer")
  @Generated("identity")
  id!: number;

  @Field("string")
  name!: string;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("projectDesiredSchemaSqlite", () => {
  test("projects a rich entity with enums, computed, defaults, embedded lists and relations", () => {
    const schema = projectDesiredSchemaSqlite(
      [getEntityMetadata(GoldUser), getEntityMetadata(GoldPost)],
      {},
    );

    expect(schema).toMatchSnapshot();
  });

  test("projects single-table inheritance into the root table only", () => {
    const entities = [GoldVehicle, GoldCar, GoldTruck];
    const inheritanceMap = resolveInheritanceHierarchies(entities);
    const schema = projectDesiredSchemaSqlite(
      entities.map((e) => getEntityMetadata(e, inheritanceMap)),
      {},
    );

    expect(schema.tables).toHaveLength(1);
    expect(schema).toMatchSnapshot();
  });

  test("projects joined inheritance into root and child tables with inheritance FKs", () => {
    const entities = [GoldAnimal, GoldDog, GoldCat];
    const inheritanceMap = resolveInheritanceHierarchies(entities);
    const schema = projectDesiredSchemaSqlite(
      entities.map((e) => getEntityMetadata(e, inheritanceMap)),
      {},
    );

    expect(schema.tables).toHaveLength(3);
    expect(schema).toMatchSnapshot();
  });

  test("projects ManyToMany join table", () => {
    const schema = projectDesiredSchemaSqlite(
      [getEntityMetadata(GoldCourse), getEntityMetadata(GoldStudent)],
      {},
    );

    const joinTable = schema.tables.find(
      (t) => t.name !== "GoldCourse" && t.name !== "GoldStudent",
    );
    expect(joinTable).toBeDefined();
    expect(joinTable!.foreignKeys.length).toBeGreaterThanOrEqual(2);
    expect(schema).toMatchSnapshot();
  });

  test("projects append-only triggers", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldLedger)], {});

    expect(schema.tables[0].triggers).toHaveLength(2);
    expect(schema).toMatchSnapshot();
  });

  test("projects indexes, uniques and sparse index WHERE clauses", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldIndexed)], {});

    expect(schema).toMatchSnapshot();
  });

  test("projects check constraints", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldChecked)], {});

    expect(schema).toMatchSnapshot();
  });

  test("projects with namespace (name-only tables, no schema qualification)", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldChecked)], {
      namespace: "myapp",
    });

    expect(schema).toMatchSnapshot();
  });

  test("projects boolean defaults as 1 and 0", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldFlags)], {});

    const table = schema.tables[0];
    expect(table.columns.find((c) => c.name === "isActive")?.defaultExpr).toBe("1");
    expect(table.columns.find((c) => c.name === "isArchived")?.defaultExpr).toBe("0");
    expect(schema).toMatchSnapshot();
  });

  test("projects encrypted fields as TEXT while encrypted enums keep their CHECK expression", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldSecret)], {});

    const table = schema.tables[0];
    const secret = table.columns.find((c) => c.name === "secret");
    expect(secret?.sqliteType).toBe("TEXT");
    expect(secret?.checkExpr).toBeNull();
    const status = table.columns.find((c) => c.name === "status");
    expect(status?.sqliteType).toBe("TEXT");
    expect(status?.checkExpr).toBe(`CHECK("status" IN ('active', 'archived'))`);
    expect(schema).toMatchSnapshot();
  });

  test("projects typedJson sidecar companion columns", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldTyped)], {});

    const table = schema.tables[0];
    const sidecar = table.columns.find((c) => c.name === "payload__typemeta");
    expect(sidecar).toBeDefined();
    expect(sidecar?.sqliteType).toBe("TEXT");
    expect(sidecar?.nullable).toBe(true);
    expect(schema).toMatchSnapshot();
  });

  test("projects @Generated('identity') as a plain column without autoincrement", () => {
    const schema = projectDesiredSchemaSqlite([getEntityMetadata(GoldIdentity)], {});

    const id = schema.tables[0].columns.find((c) => c.name === "id");
    expect(id?.isAutoincrement).toBe(false);
    expect(id?.defaultExpr).toBeNull();
    expect(schema).toMatchSnapshot();
  });
});
