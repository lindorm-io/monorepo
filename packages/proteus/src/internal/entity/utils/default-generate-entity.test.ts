import {
  CLIENT_SIDE_CREATE_STRATEGIES,
  defaultGenerateEntity,
  generateCreateEntity,
  isClientSideCreateStrategy,
} from "./default-generate-entity.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { Generated } from "../../../decorators/Generated.js";
import { PrimaryKey } from "../../../decorators/PrimaryKey.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "GenerateUuidEntity" })
class GenerateUuidEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

@Entity({ name: "GenerateStringEntity" })
class GenerateStringEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

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
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("timestamp")
  @Generated("date")
  generatedAt!: Date;
}

@Entity({ name: "GenerateLindormIdEntity" })
class GenerateLindormIdEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("varchar")
  @Generated()
  token!: string;
}

@Entity({ name: "GenerateLindormIdLengthEntity" })
class GenerateLindormIdLengthEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("varchar")
  @Generated("lindorm_id", { length: 32 })
  token!: string;
}

@Entity({ name: "GenerateLindormIdNamespaceEntity" })
class GenerateLindormIdNamespaceEntity {
  @PrimaryKeyField() @Generated("lindorm_id", { namespace: "user" }) id!: string;
}

@Entity({ name: "GenerateFunctionEntity" })
class GenerateFunctionEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  @Generated(() => "fixed-value")
  slug!: string;
}

@Entity({ name: "NaturalKeyEntity" })
class NaturalKeyEntity {
  @PrimaryKeyField("string") id!: string;

  @Field("string")
  name!: string;
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

  test("should generate a 24-char base62 lindorm id for default strategy", () => {
    const entity: any = { id: "abc", token: undefined };
    defaultGenerateEntity(GenerateLindormIdEntity, entity);
    expect(entity.token).toMatch(/^[A-Za-z0-9]{24}$/);
  });

  test("should respect the length option for lindorm_id", () => {
    const entity: any = { id: "abc", token: undefined };
    defaultGenerateEntity(GenerateLindormIdLengthEntity, entity);
    expect(entity.token).toMatch(/^[A-Za-z0-9]{32}$/);
  });

  test("should respect the namespace option for lindorm_id", () => {
    const entity: any = { id: undefined };
    defaultGenerateEntity(GenerateLindormIdNamespaceEntity, entity);
    expect(entity.id).toMatch(/^user_[A-Za-z0-9]{24}$/);
  });

  test("should use a function generator at insert time", () => {
    const entity: any = { id: "abc", slug: undefined };
    defaultGenerateEntity(GenerateFunctionEntity, entity);
    expect(entity.slug).toBe("fixed-value");
  });

  test("should throw when a PK has no generator and no provided value", () => {
    const entity: any = { id: undefined, name: "test" };
    expect(() => defaultGenerateEntity(NaturalKeyEntity, entity)).toThrow(
      "Missing primary key value",
    );
  });

  test("should accept a natural PK when the value is provided explicitly", () => {
    const entity: any = { id: "user-provided", name: "test" };
    const result = defaultGenerateEntity(NaturalKeyEntity, entity);
    expect(result.id).toBe("user-provided");
  });
});

describe("isClientSideCreateStrategy", () => {
  test("classifies the three client-side IDENTITY strategies as create-time", () => {
    expect(CLIENT_SIDE_CREATE_STRATEGIES).toEqual(["lindorm_id", "string", "uuid"]);
    for (const strategy of CLIENT_SIDE_CREATE_STRATEGIES) {
      expect(isClientSideCreateStrategy(strategy)).toBe(true);
    }
  });

  test("classifies DB-assigned and persist-time strategies as deferred", () => {
    expect(isClientSideCreateStrategy("date")).toBe(false);
    expect(isClientSideCreateStrategy("increment")).toBe(false);
    expect(isClientSideCreateStrategy("identity")).toBe(false);
    // float/integer are client-computable but intentionally left at insert.
    expect(isClientSideCreateStrategy("float")).toBe(false);
    expect(isClientSideCreateStrategy("integer")).toBe(false);
    expect(isClientSideCreateStrategy(null)).toBe(false);
  });
});

describe("generateCreateEntity", () => {
  test("generates a uuid PK at create time", () => {
    const entity: any = { id: undefined, name: "test" };
    generateCreateEntity(GenerateUuidEntity, entity);
    expect(entity.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("generates a lindorm_id PK at create time", () => {
    const entity: any = { id: undefined };
    generateCreateEntity(GenerateLindormIdNamespaceEntity, entity);
    expect(entity.id).toMatch(/^user_[A-Za-z0-9]{24}$/);
  });

  test("generates a string field at create time", () => {
    const entity: any = { id: undefined, token: undefined };
    generateCreateEntity(GenerateStringEntity, entity);
    // uuid PK + string token are both client-side.
    expect(entity.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(typeof entity.token).toBe("string");
    expect(entity.token.length).toBeGreaterThan(0);
  });

  test("does not overwrite a caller-supplied id", () => {
    const entity: any = { id: "existing-uuid-value", name: "test" };
    generateCreateEntity(GenerateUuidEntity, entity);
    expect(entity.id).toBe("existing-uuid-value");
  });

  test("leaves increment PKs untouched (DB-assigned, deferred to insert)", () => {
    const entity: any = { id: undefined, name: "test" };
    generateCreateEntity(GenerateIncrementEntity, entity);
    expect(entity.id).toBeUndefined();
  });

  test("leaves date fields untouched (persist-time, deferred to insert)", () => {
    const entity: any = { id: undefined, generatedAt: undefined };
    generateCreateEntity(GenerateDateEntity, entity);
    // uuid PK is minted, the date field is not.
    expect(typeof entity.id).toBe("string");
    expect(entity.generatedAt).toBeUndefined();
  });

  test("leaves custom-generator fields to insert (strategy is not a client-side identity)", () => {
    const entity: any = { id: undefined, slug: undefined };
    generateCreateEntity(GenerateFunctionEntity, entity);
    expect(typeof entity.id).toBe("string");
    expect(entity.slug).toBeUndefined();
  });

  test("returns the same entity object", () => {
    const entity: any = { id: undefined, name: "test" };
    expect(generateCreateEntity(GenerateUuidEntity, entity)).toBe(entity);
  });
});
