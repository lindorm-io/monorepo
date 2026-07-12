import { z } from "zod";
import { defaultValidateEntity } from "./default-validate-entity.js";
import { Embeddable } from "../../../decorators/Embeddable.js";
import { Embedded } from "../../../decorators/Embedded.js";
import { EmbeddedList } from "../../../decorators/EmbeddedList.js";
import { Entity } from "../../../decorators/Entity.js";
import { Enum } from "../../../decorators/Enum.js";
import { Field } from "../../../decorators/Field.js";
import { Max } from "../../../decorators/Max.js";
import { Min } from "../../../decorators/Min.js";
import { Nullable } from "../../../decorators/Nullable.js";
import { OnValidate } from "../../../decorators/OnValidate.js";
import { Generated } from "../../../decorators/Generated.js";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField.js";
import { Schema } from "../../../decorators/Schema.js";
import { VersionField } from "../../../decorators/VersionField.js";
import { describe, expect, test, vi } from "vitest";

enum Status {
  Active = "active",
  Inactive = "inactive",
}

@Entity({ name: "ValidateEntityBasic" })
class ValidateEntityBasic {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @VersionField()
  version!: number;

  @Field("string")
  name!: string;

  @Field("integer")
  age!: number;

  @Field("boolean")
  active!: boolean;

  @Nullable()
  @Field("string")
  email!: string | null;
}

@Entity({ name: "ValidateEntityMinMax" })
class ValidateEntityMinMax {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Min(3)
  @Max(50)
  @Field("string")
  name!: string;

  @Min(0)
  @Max(150)
  @Field("integer")
  age!: number;
}

@Entity({ name: "ValidateEntityEnum" })
class ValidateEntityEnum {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Enum(Status)
  @Field("enum")
  status!: Status;
}

const nameSchema = z.object({ name: z.string().min(1) });
const validateSchemaCb = vi.fn();

@Entity({ name: "ValidateEntityWithSchema" })
@Schema(nameSchema)
@OnValidate(validateSchemaCb)
class ValidateEntityWithSchema {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("string")
  name!: string;
}

describe("defaultValidateEntity", () => {
  test("should pass for valid entity", () => {
    const entity = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      version: 1,
      name: "Alice",
      age: 30,
      active: true,
      email: null,
    } as ValidateEntityBasic;

    expect(() => defaultValidateEntity(ValidateEntityBasic, entity)).not.toThrow();
  });

  test("should throw for wrong type (non-integer age)", () => {
    const entity = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      version: 1,
      name: "Alice",
      age: "thirty" as any,
      active: true,
      email: null,
    };

    expect(() => defaultValidateEntity(ValidateEntityBasic, entity as any)).toThrow();
  });

  test("should throw for invalid uuid", () => {
    const entity = {
      id: "not-a-uuid",
      version: 1,
      name: "Alice",
      age: 30,
      active: true,
      email: null,
    };

    expect(() => defaultValidateEntity(ValidateEntityBasic, entity as any)).toThrow();
  });

  test("should pass when nullable field is null", () => {
    const entity = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      version: 1,
      name: "Alice",
      age: 25,
      active: false,
      email: null,
    } as ValidateEntityBasic;

    expect(() => defaultValidateEntity(ValidateEntityBasic, entity)).not.toThrow();
  });

  test("should validate min/max constraints", () => {
    const valid = { id: "550e8400-e29b-41d4-a716-446655440000", name: "Alice", age: 25 };
    expect(() => defaultValidateEntity(ValidateEntityMinMax, valid as any)).not.toThrow();

    const tooShort = { id: "550e8400-e29b-41d4-a716-446655440000", name: "A", age: 25 };
    expect(() => defaultValidateEntity(ValidateEntityMinMax, tooShort as any)).toThrow();
  });

  test("should validate enum field", () => {
    const valid = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      status: Status.Active,
    };
    expect(() => defaultValidateEntity(ValidateEntityEnum, valid as any)).not.toThrow();

    const invalid = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      status: "unknown-status",
    };
    expect(() => defaultValidateEntity(ValidateEntityEnum, invalid as any)).toThrow();
  });

  test("should not call OnValidate hooks during validation (hooks are dispatched by EntityManager)", () => {
    validateSchemaCb.mockClear();
    const entity = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Bob",
    };
    defaultValidateEntity(ValidateEntityWithSchema, entity as any);
    expect(validateSchemaCb).not.toHaveBeenCalled();
  });

  test("should validate against Schema", () => {
    const invalid = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "",
    };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithSchema, invalid as any),
    ).toThrow();
  });
});

// ─── B8: @EmbeddedList Zod validation ────────────────────────────────────────

@Embeddable()
class TagItem {
  @Field("string")
  label!: string;

  @Field("integer")
  priority!: number;
}

@Entity({ name: "ValidateEntityWithPrimitiveLists" })
class ValidateEntityWithPrimitiveLists {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @EmbeddedList("string")
  tags!: string[];

  @EmbeddedList("integer", { tableName: "validate_scores" })
  scores!: number[];
}

@Entity({ name: "ValidateEntityWithEmbeddableList" })
class ValidateEntityWithEmbeddableList {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @EmbeddedList(() => TagItem)
  items!: TagItem[];
}

describe("defaultValidateEntity — @EmbeddedList (B8)", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  test("should pass for valid primitive @EmbeddedList (string[])", () => {
    const entity = {
      id: validUuid,
      tags: ["typescript", "node"],
      scores: [10, 20, 30],
    };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithPrimitiveLists, entity as any),
    ).not.toThrow();
  });

  test("should pass for empty primitive @EmbeddedList", () => {
    const entity = { id: validUuid, tags: [], scores: [] };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithPrimitiveLists, entity as any),
    ).not.toThrow();
  });

  test("should reject invalid element type in primitive string @EmbeddedList", () => {
    // numbers in a string[] list must fail validation
    const entity = {
      id: validUuid,
      tags: [42, "valid-string"] as any,
      scores: [10],
    };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithPrimitiveLists, entity as any),
    ).toThrow();
  });

  test("should reject non-array value for @EmbeddedList field", () => {
    const entity = {
      id: validUuid,
      tags: "not-an-array" as any,
      scores: [1],
    };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithPrimitiveLists, entity as any),
    ).toThrow();
  });

  test("should pass for valid embeddable @EmbeddedList", () => {
    const entity = {
      id: validUuid,
      items: [
        { label: "high", priority: 1 },
        { label: "low", priority: 3 },
      ],
    };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithEmbeddableList, entity as any),
    ).not.toThrow();
  });

  test("should pass for empty embeddable @EmbeddedList", () => {
    const entity = { id: validUuid, items: [] };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithEmbeddableList, entity as any),
    ).not.toThrow();
  });

  test("should reject embeddable @EmbeddedList element with wrong field type", () => {
    // priority must be integer — pass a string instead
    const entity = {
      id: validUuid,
      items: [{ label: "bad", priority: "not-a-number" }],
    };
    expect(() =>
      defaultValidateEntity(ValidateEntityWithEmbeddableList, entity as any),
    ).toThrow();
  });
});

// ─── H1: @Embedded nullable validation ───────────────────────────────────────

@Embeddable()
class H1Address {
  @Field("string")
  street!: string;

  @Field("string")
  city!: string;

  @Nullable()
  @Field("string")
  zip!: string | null;
}

@Entity({ name: "H1EmbeddedNullableEntity" })
class H1EmbeddedNullableEntity {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Embedded(() => H1Address)
  address!: H1Address | null;
}

describe("defaultValidateEntity — @Embedded nullable (H1)", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  test("should pass when embedded parent is null (skip child validation)", () => {
    const entity = { id: validUuid, address: null };
    expect(() =>
      defaultValidateEntity(H1EmbeddedNullableEntity, entity as any),
    ).not.toThrow();
  });

  test("should pass when embedded parent is present with all required fields", () => {
    const entity = {
      id: validUuid,
      address: { street: "123 Main St", city: "Springfield", zip: "62701" },
    };
    expect(() =>
      defaultValidateEntity(H1EmbeddedNullableEntity, entity as any),
    ).not.toThrow();
  });

  test("should pass when embedded parent is present with nullable child set to null", () => {
    const entity = {
      id: validUuid,
      address: { street: "123 Main St", city: "Springfield", zip: null },
    };
    expect(() =>
      defaultValidateEntity(H1EmbeddedNullableEntity, entity as any),
    ).not.toThrow();
  });

  test("should reject when embedded parent is present but required child is null", () => {
    // street is non-nullable in H1Address — must fail when parent is present
    const entity = {
      id: validUuid,
      address: { street: null, city: "Springfield", zip: null },
    };
    expect(() =>
      defaultValidateEntity(H1EmbeddedNullableEntity, entity as any),
    ).toThrow();
  });

  test("should reject when embedded parent is present but required child is missing", () => {
    // city is non-nullable in H1Address — must fail when parent is present
    const entity = {
      id: validUuid,
      address: { street: "123 Main St", zip: null },
    };
    expect(() =>
      defaultValidateEntity(H1EmbeddedNullableEntity, entity as any),
    ).toThrow();
  });

  test("should reject when embedded parent is present with wrong child type", () => {
    const entity = {
      id: validUuid,
      address: { street: 42, city: "Springfield", zip: null },
    };
    expect(() =>
      defaultValidateEntity(H1EmbeddedNullableEntity, entity as any),
    ).toThrow();
  });

  describe("strict validation", () => {
    test("should reject unknown top-level fields", () => {
      const entity = {
        id: validUuid,
        version: 1,
        name: "bob",
        age: 30,
        active: true,
        email: null,
        stray: "shouldn't be here",
      };
      expect(() => defaultValidateEntity(ValidateEntityBasic, entity as any)).toThrow(
        /Unrecognized key/,
      );
    });

    test("should reject unknown keys inside embedded objects", () => {
      const entity = {
        id: validUuid,
        address: {
          street: "Main",
          city: "Springfield",
          zip: 12345,
          suite: "extra",
        },
      };
      expect(() =>
        defaultValidateEntity(H1EmbeddedNullableEntity, entity as any),
      ).toThrow(/Unrecognized key/);
    });
  });
});

// ─── Field-level @Schema validation ──────────────────────────────────────────

const settingsSchema = z.object({
  theme: z.enum(["light", "dark"]),
  fontSize: z.number().int().min(8),
});

@Entity({ name: "FieldSchemaJson" })
class FieldSchemaJson {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Schema(settingsSchema)
  @Field("json")
  settings!: { theme: string; fontSize: number };
}

@Entity({ name: "FieldSchemaNullable" })
class FieldSchemaNullable {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Schema(settingsSchema)
  @Nullable()
  @Field("json")
  settings!: { theme: string; fontSize: number } | null;
}

@Entity({ name: "FieldSchemaArray" })
class FieldSchemaArray {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Schema(z.array(z.object({ label: z.string().min(1), weight: z.number() })))
  @Field("array")
  entries!: Array<{ label: string; weight: number }>;
}

@Entity({ name: "FieldSchemaObject" })
class FieldSchemaObject {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Schema(settingsSchema)
  @Field("object")
  settings!: { theme: string; fontSize: number };
}

@Embeddable()
class FieldSchemaEmbeddablePrefs {
  @Field("string")
  locale!: string;

  @Schema(settingsSchema)
  @Field("json")
  settings!: { theme: string; fontSize: number };
}

@Entity({ name: "FieldSchemaEmbedded" })
class FieldSchemaEmbedded {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Embedded(() => FieldSchemaEmbeddablePrefs)
  prefs!: FieldSchemaEmbeddablePrefs | null;
}

@Entity({ name: "FieldSchemaEmbeddedList" })
class FieldSchemaEmbeddedList {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @EmbeddedList(() => FieldSchemaEmbeddablePrefs)
  prefs!: Array<FieldSchemaEmbeddablePrefs>;
}

@Entity({ name: "FieldSchemaBothKinds" })
@Schema(
  z
    .looseObject({ start: z.number(), end: z.number() })
    .refine((v) => v.start <= v.end, { error: "start must be <= end" }),
)
class FieldSchemaBothKinds {
  @PrimaryKeyField() @Generated("uuid") id!: string;

  @Field("integer")
  start!: number;

  @Field("integer")
  end!: number;

  @Schema(settingsSchema)
  @Field("json")
  settings!: { theme: string; fontSize: number };
}

describe("defaultValidateEntity — field-level @Schema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validSettings = { theme: "dark", fontSize: 12 };

  test("should pass for valid json field value", () => {
    const entity = { id: validUuid, settings: validSettings };
    expect(() => defaultValidateEntity(FieldSchemaJson, entity as any)).not.toThrow();
  });

  test("should throw for invalid json field value and surface the zod issue", () => {
    const entity = { id: validUuid, settings: { theme: "neon", fontSize: 12 } };
    expect(() => defaultValidateEntity(FieldSchemaJson, entity as any)).toThrow(/theme/);
  });

  test("should enforce nested bounds from the field schema", () => {
    // the default loose object would accept any fontSize — the field schema won't
    const entity = { id: validUuid, settings: { ...validSettings, fontSize: 6 } };
    expect(() => defaultValidateEntity(FieldSchemaJson, entity as any)).toThrow(
      /fontSize/,
    );
  });

  test("should compose with @Nullable — null passes", () => {
    const entity = { id: validUuid, settings: null };
    expect(() => defaultValidateEntity(FieldSchemaNullable, entity as any)).not.toThrow();
  });

  test("should compose with @Nullable — undefined passes", () => {
    const entity = { id: validUuid };
    expect(() => defaultValidateEntity(FieldSchemaNullable, entity as any)).not.toThrow();
  });

  test("should compose with @Nullable — present but invalid value throws", () => {
    const entity = { id: validUuid, settings: { theme: "dark", fontSize: 4 } };
    expect(() => defaultValidateEntity(FieldSchemaNullable, entity as any)).toThrow(
      /fontSize/,
    );
  });

  test("should pass for valid array field elements", () => {
    const entity = { id: validUuid, entries: [{ label: "a", weight: 1 }] };
    expect(() => defaultValidateEntity(FieldSchemaArray, entity as any)).not.toThrow();
  });

  test("should throw for invalid array field element", () => {
    const entity = { id: validUuid, entries: [{ label: "", weight: 1 }] };
    expect(() => defaultValidateEntity(FieldSchemaArray, entity as any)).toThrow(/label/);
  });

  test("should pass and throw for object field", () => {
    const valid = { id: validUuid, settings: validSettings };
    expect(() => defaultValidateEntity(FieldSchemaObject, valid as any)).not.toThrow();

    const invalid = { id: validUuid, settings: { theme: "dark", fontSize: "big" } };
    expect(() => defaultValidateEntity(FieldSchemaObject, invalid as any)).toThrow(
      /fontSize/,
    );
  });

  test("should enforce field schema inside an @Embedded entity", () => {
    const valid = { id: validUuid, prefs: { locale: "sv", settings: validSettings } };
    expect(() => defaultValidateEntity(FieldSchemaEmbedded, valid as any)).not.toThrow();

    const invalid = {
      id: validUuid,
      prefs: { locale: "sv", settings: { theme: "neon", fontSize: 12 } },
    };
    expect(() => defaultValidateEntity(FieldSchemaEmbedded, invalid as any)).toThrow(
      /theme/,
    );
  });

  test("should enforce field schema inside @EmbeddedList elements", () => {
    const valid = {
      id: validUuid,
      prefs: [{ locale: "sv", settings: validSettings }],
    };
    expect(() =>
      defaultValidateEntity(FieldSchemaEmbeddedList, valid as any),
    ).not.toThrow();

    const invalid = {
      id: validUuid,
      prefs: [{ locale: "sv", settings: { theme: "dark", fontSize: 4 } }],
    };
    expect(() => defaultValidateEntity(FieldSchemaEmbeddedList, invalid as any)).toThrow(
      /fontSize/,
    );
  });

  test("should compose class-level and field-level schemas on one entity", () => {
    const valid = { id: validUuid, start: 1, end: 2, settings: validSettings };
    expect(() => defaultValidateEntity(FieldSchemaBothKinds, valid as any)).not.toThrow();

    const fieldInvalid = {
      id: validUuid,
      start: 1,
      end: 2,
      settings: { theme: "neon", fontSize: 12 },
    };
    expect(() =>
      defaultValidateEntity(FieldSchemaBothKinds, fieldInvalid as any),
    ).toThrow(/theme/);

    const classInvalid = { id: validUuid, start: 3, end: 2, settings: validSettings };
    expect(() =>
      defaultValidateEntity(FieldSchemaBothKinds, classInvalid as any),
    ).toThrow(/start must be <= end/);
  });
});

@Entity({ name: "ValidateEntityLindormId" })
class ValidateEntityLindormId {
  @PrimaryKeyField("lindorm_id") @Generated() id!: string;
}

describe("defaultValidateEntity — lindorm_id", () => {
  const validate = (id: string): void =>
    defaultValidateEntity(ValidateEntityLindormId, { id } as any);

  test("should pass for a bare 24-character base62 id", () => {
    expect(() => validate("A1b2C3d4E5f6G7h8I9j0K1l2")).not.toThrow();
  });

  test("should pass for a namespaced id", () => {
    expect(() => validate("client_A1b2C3d4E5f6G7h8I9j0K1l2")).not.toThrow();
  });

  test("should pass for the minimum body length (16)", () => {
    expect(() => validate("A1b2C3d4E5f6G7h8")).not.toThrow();
  });

  test("should pass for the maximum body length (64)", () => {
    expect(() => validate("A".repeat(64))).not.toThrow();
  });

  test("should throw for a body that is too short (15)", () => {
    expect(() => validate("A1b2C3d4E5f6G7h")).toThrow();
  });

  test("should throw for a body that is too long (65)", () => {
    expect(() => validate("A".repeat(65))).toThrow();
  });

  test("should throw for invalid characters", () => {
    expect(() => validate("A1b2C3d4-5f6G7h8I9j0K1l2")).toThrow();
    expect(() => validate("A1b2C3d4E5f6G7h8I9j0K1l!")).toThrow();
  });

  test("should throw for a double underscore", () => {
    expect(() => validate("client__A1b2C3d4E5f6G7h8I9j0K1l2")).toThrow();
  });

  test("should throw for an empty namespace", () => {
    expect(() => validate("_A1b2C3d4E5f6G7h8I9j0K1l2")).toThrow();
  });

  test("should throw for a uuid", () => {
    expect(() => validate("550e8400-e29b-41d4-a716-446655440000")).toThrow();
  });
});
