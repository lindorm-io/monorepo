import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Hide } from "./Hide";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { describe, expect, test } from "vitest";

@Entity({ name: "HideBothTest" })
class HideBothTest {
  @PrimaryKeyField()
  id!: string;

  @Hide()
  @Field("string")
  secret!: string;
}

@Entity({ name: "HideSingleTest" })
class HideSingleTest {
  @PrimaryKeyField()
  id!: string;

  @Hide("single")
  @Field("string")
  secret!: string;
}

@Entity({ name: "HideMultipleTest" })
class HideMultipleTest {
  @PrimaryKeyField()
  id!: string;

  @Hide("multiple")
  @Field("string")
  secret!: string;
}

describe("Hide", () => {
  test("@Hide() hides on both scopes", () => {
    const meta = getEntityMetadata(HideBothTest);
    const field = meta.fields.find((f) => f.key === "secret");
    expect(field?.hideOn).toEqual(expect.arrayContaining(["single", "multiple"]));
  });

  test('@Hide("single") hides on single scope only', () => {
    const meta = getEntityMetadata(HideSingleTest);
    const field = meta.fields.find((f) => f.key === "secret");
    expect(field?.hideOn).toEqual(["single"]);
  });

  test('@Hide("multiple") hides on multiple scope only', () => {
    const meta = getEntityMetadata(HideMultipleTest);
    const field = meta.fields.find((f) => f.key === "secret");
    expect(field?.hideOn).toEqual(["multiple"]);
  });
});
