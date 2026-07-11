import { describe, expect, test } from "vitest";
import {
  AppendOnly,
  Check,
  Default,
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
  Nullable,
  PrimaryKey,
  PrimaryKeyField,
  Unique,
} from "../../../../../decorators/index.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { resolveInheritanceHierarchies } from "../../../../entity/metadata/resolve-inheritance.js";
import { projectDesiredSchemaMysql } from "./project-desired-schema-mysql.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────
//
// Golden fixture set locking MySQL-specific projection behavior: inline
// enum('a','b') column types (incl. quote escaping), inheritance strategies,
// collection tables with composite (parentFk, __ordinal) PKs, append-only
// triggers, 1/0 boolean defaults, the encrypted-enum drift quirk (text type,
// enumValues still populated), identity-ignored plain columns, and sparse
// indexes whose WHERE clause is dropped.

enum MyGoldStatus {
  Active = "active",
  Archived = "archived",
}

enum MyGoldMood {
  Happy = "happy",
  Cant = "can't",
}

@Entity({ name: "MyGoldEnumEntity" })
class MyGoldEnumEntity {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Enum(MyGoldStatus)
  @Field("enum")
  status!: MyGoldStatus;

  @Enum(MyGoldMood)
  @Nullable()
  @Field("enum")
  mood!: MyGoldMood | null;
}

@Inheritance("joined")
@Discriminator("kind")
@Entity({ name: "MyGoldAnimal" })
class MyGoldAnimal {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  kind!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "MyGoldDog" })
@DiscriminatorValue("dog")
@Unique<typeof MyGoldDog>(["breed"], { name: "unique_my_gold_dog_breed" })
@Check("length(breed) > 0", { name: "my_gold_dog_breed_not_empty" })
class MyGoldDog extends MyGoldAnimal {
  @Field("string")
  breed!: string;
}

@Inheritance("single-table")
@Discriminator("kind")
@Entity({ name: "MyGoldVehicle" })
class MyGoldVehicle {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  kind!: string;

  @Field("string")
  make!: string;
}

@Entity({ name: "MyGoldCar" })
@DiscriminatorValue("car")
class MyGoldCar extends MyGoldVehicle {
  @Nullable()
  @Field("integer")
  seatCount!: number | null;
}

@Embeddable()
class MyGoldAddress {
  @Field("string")
  street!: string;

  @Nullable()
  @Field("string")
  zip!: string | null;

  @Enum(MyGoldStatus)
  @Field("enum")
  status!: MyGoldStatus;
}

@Entity({ name: "MyGoldUser" })
class MyGoldUser {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  name!: string;

  @EmbeddedList("string")
  tags!: string[];

  @EmbeddedList(() => MyGoldAddress)
  addresses!: MyGoldAddress[];
}

@AppendOnly()
@Entity({ name: "MyGoldLedger" })
class MyGoldLedger {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  event!: string;
}

@Entity({ name: "MyGoldFlags" })
class MyGoldFlags {
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

@Entity({ name: "MyGoldSecret" })
class MyGoldSecret {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Encrypted()
  @Enum(MyGoldStatus)
  @Field("enum")
  status!: MyGoldStatus;
}

@Entity({ name: "MyGoldIdentity" })
class MyGoldIdentity {
  @PrimaryKey()
  @Field("integer")
  @Generated("identity")
  id!: number;

  @Field("string")
  name!: string;
}

@Entity({ name: "MyGoldSparse" })
class MyGoldSparse {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Index("asc", { name: "my_gold_sparse_region", sparse: true })
  @Nullable()
  @Field("string")
  region!: string | null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("projectDesiredSchemaMysql (golden)", () => {
  test("projects enum fields as inline enum('a','b') column types with quote escaping", () => {
    const schema = projectDesiredSchemaMysql([getEntityMetadata(MyGoldEnumEntity)], {});

    const table = schema.tables[0];
    const status = table.columns.find((c) => c.name === "status");
    expect(status?.mysqlType).toBe("enum('active','archived')");
    const mood = table.columns.find((c) => c.name === "mood");
    expect(mood?.mysqlType).toBe("enum('happy','can''t')");
    expect(schema).toMatchSnapshot();
  });

  test("projects joined inheritance with inheritance FK, child uniques and checks", () => {
    const entities = [MyGoldAnimal, MyGoldDog];
    const inheritanceMap = resolveInheritanceHierarchies(entities);
    const schema = projectDesiredSchemaMysql(
      entities.map((e) => getEntityMetadata(e, inheritanceMap)),
      {},
    );

    expect(schema.tables).toHaveLength(2);
    const child = schema.tables.find((t) => t.name === "MyGoldDog");
    expect(child).toBeDefined();
    expect(child!.foreignKeys).toHaveLength(1);
    expect(child!.foreignKeys[0].foreignTable).toBe("MyGoldAnimal");
    expect(schema).toMatchSnapshot();
  });

  test("projects single-table inheritance into the root table with discriminator index", () => {
    const entities = [MyGoldVehicle, MyGoldCar];
    const inheritanceMap = resolveInheritanceHierarchies(entities);
    const schema = projectDesiredSchemaMysql(
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

  test("projects embedded lists into collection tables with (parentFk, __ordinal) primary key", () => {
    const schema = projectDesiredSchemaMysql([getEntityMetadata(MyGoldUser)], {});

    const collectionTables = schema.tables.filter((t) => t.name !== "MyGoldUser");
    expect(collectionTables).toHaveLength(2);
    for (const table of collectionTables) {
      expect(table.primaryKeys).toHaveLength(2);
      expect(table.primaryKeys[1]).toBe("__ordinal");
    }
    expect(schema).toMatchSnapshot();
  });

  test("projects append-only triggers", () => {
    const schema = projectDesiredSchemaMysql([getEntityMetadata(MyGoldLedger)], {});

    expect(schema.tables[0].triggers).toHaveLength(2);
    expect(schema).toMatchSnapshot();
  });

  test("projects boolean defaults as 1 and 0", () => {
    const schema = projectDesiredSchemaMysql([getEntityMetadata(MyGoldFlags)], {});

    const table = schema.tables[0];
    expect(table.columns.find((c) => c.name === "isActive")?.defaultExpr).toBe("1");
    expect(table.columns.find((c) => c.name === "isArchived")?.defaultExpr).toBe("0");
    expect(schema).toMatchSnapshot();
  });

  test("projects encrypted enum fields as text while enumValues remain populated", () => {
    const schema = projectDesiredSchemaMysql([getEntityMetadata(MyGoldSecret)], {});

    const status = schema.tables[0].columns.find((c) => c.name === "status");
    expect(status?.mysqlType).toBe("text");
    expect(status?.enumValues).toEqual(["active", "archived"]);
    expect(schema).toMatchSnapshot();
  });

  test("projects @Generated('identity') as a plain column without auto-increment", () => {
    const schema = projectDesiredSchemaMysql([getEntityMetadata(MyGoldIdentity)], {});

    const id = schema.tables[0].columns.find((c) => c.name === "id");
    expect(id?.isAutoIncrement).toBe(false);
    expect(id?.defaultExpr).toBeNull();
    expect(schema).toMatchSnapshot();
  });

  test("projects sparse indexes without a WHERE clause", () => {
    const schema = projectDesiredSchemaMysql([getEntityMetadata(MyGoldSparse)], {});

    const index = schema.tables[0].indexes.find(
      (i) => i.name === "my_gold_sparse_region",
    );
    expect(index).toBeDefined();
    expect(index).not.toHaveProperty("where");
    expect(schema).toMatchSnapshot();
  });
});
