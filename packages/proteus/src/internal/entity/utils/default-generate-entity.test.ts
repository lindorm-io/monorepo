import { defaultGenerateEntity } from "./default-generate-entity.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { PrimaryKey } from "../../../decorators/PrimaryKey.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "GenerateUuidEntity" })
class GenerateUuidEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "GenerateStringEntity" })
class GenerateStringEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  @Generated("string", { length: 16 })
  token!: string;
}

@Entity({ name: "GenerateIncrementEntity" })
class GenerateIncrementEntity {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  @Field("string")
  name!: string;
}

@Entity({ name: "GenerateDateEntity" })
class GenerateDateEntity {
  @PrimaryKeyField()
  id!: string;

  @Field("timestamp")
  @Generated("date")
  generatedAt!: Date;
}

describe("defaultGenerateEntity", () => {
  test("should generate uuid for PrimaryKeyField", () => {
    const entity: any = { id: undefined, name: "test" };
    defaultGenerateEntity(GenerateUuidEntity, entity);
    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe("string");
    // UUID format
    expect(entity.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("should not overwrite existing uuid", () => {
    const existingId = "existing-uuid-value";
    const entity: any = { id: existingId, name: "test" };
    defaultGenerateEntity(GenerateUuidEntity, entity);
    expect(entity.id).toBe(existingId);
  });

  test("should generate string token with correct length encoding", () => {
    const entity: any = { id: "abc", token: undefined };
    defaultGenerateEntity(GenerateStringEntity, entity);
    expect(entity.token).toBeDefined();
    expect(typeof entity.token).toBe("string");
  });

  test("should skip increment strategy (returns null, not generated)", () => {
    const entity: any = { id: undefined, name: "test" };
    defaultGenerateEntity(GenerateIncrementEntity, entity);
    expect(entity.id).toBeUndefined();
  });

  test("should generate date for date strategy", () => {
    const entity: any = { id: "abc", generatedAt: undefined };
    defaultGenerateEntity(GenerateDateEntity, entity);
    expect(entity.generatedAt).toBeInstanceOf(Date);
  });

  test("should return the entity object", () => {
    const entity: any = { id: undefined, name: "test" };
    const result = defaultGenerateEntity(GenerateUuidEntity, entity);
    expect(result).toBe(entity);
  });
});
