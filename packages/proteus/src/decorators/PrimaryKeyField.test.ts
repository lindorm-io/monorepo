import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Generated } from "./Generated.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "PrimaryKeyFieldMarkerOnly" })
class PrimaryKeyFieldMarkerOnly {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "PrimaryKeyFieldTypedMarkerOnly" })
class PrimaryKeyFieldTypedMarkerOnly {
  @PrimaryKeyField("uuid")
  id!: string;
}

@Entity({ name: "PrimaryKeyFieldLindormId" })
class PrimaryKeyFieldLindormId {
  @PrimaryKeyField()
  @Generated()
  id!: string;
}

@Entity({ name: "PrimaryKeyFieldUuid" })
class PrimaryKeyFieldUuid {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;
}

@Entity({ name: "PrimaryKeyFieldInteger" })
class PrimaryKeyFieldInteger {
  @PrimaryKeyField("integer")
  @Generated("increment")
  id!: number;
}

@Entity({ name: "PrimaryKeyFieldString" })
class PrimaryKeyFieldString {
  @PrimaryKeyField("string")
  @Generated("string")
  id!: string;
}

@Entity({ name: "PrimaryKeyFieldTypeWithName" })
class PrimaryKeyFieldTypeWithName {
  @PrimaryKeyField("uuid", { name: "pk_id" })
  @Generated("uuid")
  id!: string;
}

describe("PrimaryKeyField", () => {
  test("should register uuid primary key field (default)", () => {
    expect(getEntityMetadata(PrimaryKeyFieldUuid)).toMatchSnapshot();
  });

  test("bare marker (no type, no @Generated) throws a missing-field-type metadata error", () => {
    expect(() => getEntityMetadata(PrimaryKeyFieldMarkerOnly)).toThrow(
      "Field has no resolvable type",
    );
  });

  test("typed marker alone (no @Generated) stages a primary key and field but NO generated entry", () => {
    const meta = getEntityMetadata(PrimaryKeyFieldTypedMarkerOnly);
    expect(meta.fields.find((f) => f.key === "id")).toBeDefined();
    expect(meta.primaryKeys).toContain("id");
    expect(meta.generated.find((g) => g.key === "id")).toBeUndefined();
  });

  test("marker paired with @Generated stages a primary key, field, AND generated entry", () => {
    const meta = getEntityMetadata(PrimaryKeyFieldUuid);
    expect(meta.fields.find((f) => f.key === "id")).toBeDefined();
    expect(meta.primaryKeys).toContain("id");
    expect(meta.generated.find((g) => g.key === "id")).toBeDefined();
  });

  test("should set readonly on the field", () => {
    const meta = getEntityMetadata(PrimaryKeyFieldUuid);
    const field = meta.fields.find((f) => f.key === "id");
    expect(field!.readonly).toBe(true);
  });

  test('integer marker with explicit @Generated("increment")', () => {
    const meta = getEntityMetadata(PrimaryKeyFieldInteger);
    const field = meta.fields.find((f) => f.key === "id");
    const gen = meta.generated.find((g) => g.key === "id");
    expect(field!.type).toBe("integer");
    expect(gen!.strategy).toBe("increment");
  });

  test('string marker with explicit @Generated("string")', () => {
    const meta = getEntityMetadata(PrimaryKeyFieldString);
    const gen = meta.generated.find((g) => g.key === "id");
    expect(gen!.strategy).toBe("string");
  });

  test("should accept custom name via second argument", () => {
    const meta = getEntityMetadata(PrimaryKeyFieldTypeWithName);
    const field = meta.fields.find((f) => f.key === "id");
    expect(field!.name).toBe("pk_id");
    expect(field!.type).toBe("uuid");
  });

  test("marker paired with @Generated() infers a varchar(64) lindorm_id column", () => {
    const meta = getEntityMetadata(PrimaryKeyFieldLindormId);
    const field = meta.fields.find((f) => f.key === "id");
    expect(field!.type).toBe("varchar");
    expect(field!.max).toBe(64);
  });

  test('marker paired with @Generated("uuid") stays a uuid column (backward compat)', () => {
    const meta = getEntityMetadata(PrimaryKeyFieldUuid);
    const field = meta.fields.find((f) => f.key === "id");
    expect(field!.type).toBe("uuid");
  });
});
