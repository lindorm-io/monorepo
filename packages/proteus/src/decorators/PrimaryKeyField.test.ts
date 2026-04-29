import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "PrimaryKeyFieldUuid" })
class PrimaryKeyFieldUuid {
  @PrimaryKeyField()
  id!: string;
}

@Entity({ name: "PrimaryKeyFieldInteger" })
class PrimaryKeyFieldInteger {
  @PrimaryKeyField("integer")
  id!: number;
}

@Entity({ name: "PrimaryKeyFieldString" })
class PrimaryKeyFieldString {
  @PrimaryKeyField("string")
  id!: string;
}

@Entity({ name: "PrimaryKeyFieldTypeWithName" })
class PrimaryKeyFieldTypeWithName {
  @PrimaryKeyField("uuid", { name: "pk_id" })
  id!: string;
}

describe("PrimaryKeyField", () => {
  test("should register uuid primary key field (default)", () => {
    expect(getEntityMetadata(PrimaryKeyFieldUuid)).toMatchSnapshot();
  });

  test("should register field, primary key, and generated in one decorator", () => {
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

  test("should register integer primary key with increment strategy", () => {
    const meta = getEntityMetadata(PrimaryKeyFieldInteger);
    const field = meta.fields.find((f) => f.key === "id");
    const gen = meta.generated.find((g) => g.key === "id");
    expect(field!.type).toBe("integer");
    expect(gen!.strategy).toBe("increment");
  });

  test("should register string primary key with string strategy", () => {
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
});
