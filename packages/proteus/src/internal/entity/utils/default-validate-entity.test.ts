import { z } from "zod";
import { defaultValidateEntity } from "./default-validate-entity";
import { Embeddable } from "../../../decorators/Embeddable";
import { Embedded } from "../../../decorators/Embedded";
import { EmbeddedList } from "../../../decorators/EmbeddedList";
import { Entity } from "../../../decorators/Entity";
import { Enum } from "../../../decorators/Enum";
import { Field } from "../../../decorators/Field";
import { Max } from "../../../decorators/Max";
import { Min } from "../../../decorators/Min";
import { Nullable } from "../../../decorators/Nullable";
import { OnValidate } from "../../../decorators/OnValidate";
import { PrimaryKeyField } from "../../../decorators/PrimaryKeyField";
import { Schema } from "../../../decorators/Schema";
import { VersionField } from "../../../decorators/VersionField";
import { describe, expect, test, vi } from "vitest";

enum Status {
  Active = "active",
  Inactive = "inactive",
}

@Entity({ name: "ValidateEntityBasic" })
class ValidateEntityBasic {
  @PrimaryKeyField()
  id!: string;

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
  @PrimaryKeyField()
  id!: string;

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
  @PrimaryKeyField()
  id!: string;

  @Enum(Status)
  @Field("enum")
  status!: Status;
}

const nameSchema = z.object({ name: z.string().min(1) }) as any;
const validateSchemaCb = vi.fn();

@Entity({ name: "ValidateEntityWithSchema" })
@Schema(nameSchema)
@OnValidate(validateSchemaCb)
class ValidateEntityWithSchema {
  @PrimaryKeyField()
  id!: string;

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
  @PrimaryKeyField()
  id!: string;

  @EmbeddedList("string")
  tags!: string[];

  @EmbeddedList("integer", { tableName: "validate_scores" })
  scores!: number[];
}

@Entity({ name: "ValidateEntityWithEmbeddableList" })
class ValidateEntityWithEmbeddableList {
  @PrimaryKeyField()
  id!: string;

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
  @PrimaryKeyField()
  id!: string;

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
