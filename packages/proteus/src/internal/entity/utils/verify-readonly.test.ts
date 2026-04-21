import { verifyReadonly } from "./verify-readonly.js";
import { Entity } from "../../../decorators/Entity.js";
import { Field } from "../../../decorators/Field.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { ReadOnly } from "../../../decorators/ReadOnly.js";
import { VersionField } from "../../../decorators/VersionField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "VerifyReadonlyEntity" })
class VerifyReadonlyEntity {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @Field("string")
  name!: string;

  @ReadOnly()
  @Field("string")
  immutableField!: string;
}

describe("verifyReadonly", () => {
  test("should not throw when no readonly fields are modified", () => {
    expect(() =>
      verifyReadonly(VerifyReadonlyEntity, { name: "new name" }),
    ).not.toThrow();
  });

  test("should throw when a readonly field is included in update", () => {
    expect(() =>
      verifyReadonly(VerifyReadonlyEntity, { immutableField: "new value" }),
    ).toThrow("Field is readonly");
  });

  test("should throw when PrimaryKeyField field is included in update", () => {
    expect(() => verifyReadonly(VerifyReadonlyEntity, { id: "new-id" })).toThrow(
      "Field is readonly",
    );
  });

  test("should not throw for unknown keys (not in metadata)", () => {
    expect(() =>
      verifyReadonly(VerifyReadonlyEntity, { unknownKey: "value" } as any),
    ).not.toThrow();
  });
});
