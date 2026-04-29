import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { Field } from "./Field.js";
import { Generated } from "./Generated.js";
import { PrimaryKey } from "./PrimaryKey.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "GeneratedUuid" })
class GeneratedUuid {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;
}

@Entity({ name: "GeneratedIncrement" })
class GeneratedIncrement {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;
}

@Entity({ name: "GeneratedString" })
class GeneratedString {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  @Generated("string", { length: 16 })
  token!: string;
}

@Entity({ name: "GeneratedInteger" })
class GeneratedInteger {
  @PrimaryKeyField()
  id!: string;

  @Field("integer")
  @Generated("integer", { min: 1, max: 100 })
  rank!: number;
}

@Entity({ name: "GeneratedFloat" })
class GeneratedFloat {
  @PrimaryKeyField()
  id!: string;

  @Field("float")
  @Generated("float", { min: 0, max: 1 })
  score!: number;
}

@Entity({ name: "GeneratedDate" })
class GeneratedDate {
  @PrimaryKeyField()
  id!: string;

  @Field("timestamp")
  @Generated("date")
  generatedAt!: Date;
}

describe("Generated", () => {
  test("should register uuid generation strategy", () => {
    expect(getEntityMetadata(GeneratedUuid)).toMatchSnapshot();
  });

  test("should register increment generation strategy", () => {
    expect(getEntityMetadata(GeneratedIncrement)).toMatchSnapshot();
  });

  test("should register string generation with length option", () => {
    const meta = getEntityMetadata(GeneratedString);
    const gen = meta.generated.find((g) => g.key === "token");
    expect(gen).toBeDefined();
    expect(gen!.strategy).toBe("string");
    expect(gen!.length).toBe(16);
  });

  test("should register integer generation with min/max", () => {
    const meta = getEntityMetadata(GeneratedInteger);
    const gen = meta.generated.find((g) => g.key === "rank");
    expect(gen).toBeDefined();
    expect(gen!.min).toBe(1);
    expect(gen!.max).toBe(100);
  });

  test("should register float generation", () => {
    const meta = getEntityMetadata(GeneratedFloat);
    const gen = meta.generated.find((g) => g.key === "score");
    expect(gen!.strategy).toBe("float");
  });

  test("should register date generation", () => {
    const meta = getEntityMetadata(GeneratedDate);
    const gen = meta.generated.find((g) => g.key === "generatedAt");
    expect(gen!.strategy).toBe("date");
  });
});
