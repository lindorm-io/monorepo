import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata";
import { defaultCreateEntity } from "../internal/entity/utils/default-create-entity";
import { defaultCloneEntity } from "../internal/entity/utils/default-clone-entity";
import { defaultDehydrateEntity } from "../internal/entity/utils/default-dehydrate-entity";
import { defaultHydrateEntity } from "../internal/entity/utils/default-hydrate-entity";
import { defaultValidateEntity } from "../internal/entity/utils/default-validate-entity";
import { Embeddable } from "./Embeddable";
import { Embedded } from "./Embedded";
import { Entity } from "./Entity";
import { Field } from "./Field";
import { Nullable } from "./Nullable";
import { PrimaryKeyField } from "./PrimaryKeyField";
import { Generated } from "./Generated";
import { describe, expect, test } from "vitest";

@Embeddable()
class Coord {
  @Field("float")
  lat!: number;

  @Field("float")
  lng!: number;
}

@Embeddable()
class Address {
  @Field("string")
  street!: string;

  @Field("string")
  city!: string;

  @Field("string")
  @Nullable()
  zip!: string | null;
}

@Entity({ name: "EmbeddedTestUser" })
class EmbeddedTestUser {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Embedded(() => Address)
  homeAddress!: Address | null;

  @Embedded(() => Address, { prefix: "work_" })
  workAddress!: Address | null;
}

@Entity({ name: "EmbeddedCoordEntity" })
class EmbeddedCoordEntity {
  @PrimaryKeyField()
  id!: string;

  @Embedded(() => Coord, { prefix: "location_" })
  location!: Coord | null;
}

describe("Embedded — column collision detection", () => {
  test("should throw on duplicate column names", () => {
    expect(() => {
      @Entity({ name: "CollidingEntity" })
      class CollidingEntity {
        @PrimaryKeyField()
        id!: string;

        // Both use default prefix "addr_", so column names collide
        @Embedded(() => Address, { prefix: "addr_" })
        addr1!: Address | null;

        @Embedded(() => Address, { prefix: "addr_" })
        addr2!: Address | null;
      }

      getEntityMetadata(CollidingEntity);
    }).toThrow(/Duplicate column name/);
  });
});

describe("Embedded — non-embeddable guard", () => {
  test("should throw when referencing a class not decorated with @Embeddable", () => {
    class NotEmbeddable {
      @Field("string")
      value!: string;
    }

    expect(() => {
      @Entity({ name: "BadEmbedEntity" })
      class BadEmbedEntity {
        @PrimaryKeyField()
        id!: string;

        @Embedded(() => NotEmbeddable as any)
        nested!: any;
      }

      getEntityMetadata(BadEmbedEntity);
    }).toThrow(/not decorated with @Embeddable/);
  });
});

describe("Embedded — createEntity", () => {
  test("should create entity with embedded object from options", () => {
    const entity = defaultCreateEntity(EmbeddedTestUser, {
      name: "Alice",
      homeAddress: { street: "123 Main St", city: "Springfield", zip: "62704" },
    } as any);

    expect(entity.name).toBe("Alice");
    expect(entity.homeAddress).toBeDefined();
    expect(entity.homeAddress!.street).toBe("123 Main St");
    expect(entity.homeAddress!.city).toBe("Springfield");
    expect(entity.homeAddress!.zip).toBe("62704");
  });

  test("should set embedded to null when not provided", () => {
    const entity = defaultCreateEntity(EmbeddedTestUser, {
      name: "Bob",
    } as any);

    expect(entity.homeAddress).toBeNull();
    expect(entity.workAddress).toBeNull();
  });

  test("should handle explicit null embedded", () => {
    const entity = defaultCreateEntity(EmbeddedTestUser, {
      name: "Carol",
      homeAddress: null,
    } as any);

    expect(entity.homeAddress).toBeNull();
  });
});

describe("Embedded — dehydration", () => {
  test("should flatten embedded object into prefixed columns", () => {
    const entity = defaultCreateEntity(EmbeddedTestUser, {
      name: "Alice",
      homeAddress: { street: "123 Main St", city: "Springfield", zip: "62704" },
      workAddress: { street: "456 Work Ave", city: "Shelbyville", zip: null },
    } as any);

    const metadata = getEntityMetadata(EmbeddedTestUser);
    const row = defaultDehydrateEntity(entity, metadata, "insert");

    expect(row).toMatchSnapshot();
    expect(row["homeAddress_street"]).toBe("123 Main St");
    expect(row["homeAddress_city"]).toBe("Springfield");
    expect(row["homeAddress_zip"]).toBe("62704");
    expect(row["work_street"]).toBe("456 Work Ave");
    expect(row["work_city"]).toBe("Shelbyville");
    expect(row["work_zip"]).toBeNull();
  });

  test("should emit null for all prefixed columns when embedded is null", () => {
    const entity = defaultCreateEntity(EmbeddedTestUser, {
      name: "Bob",
    } as any);

    const metadata = getEntityMetadata(EmbeddedTestUser);
    const row = defaultDehydrateEntity(entity, metadata, "insert");

    expect(row["homeAddress_street"]).toBeNull();
    expect(row["homeAddress_city"]).toBeNull();
    expect(row["homeAddress_zip"]).toBeNull();
  });
});

describe("Embedded — hydration", () => {
  test("should reconstruct embedded object from flat row data", () => {
    const metadata = getEntityMetadata(EmbeddedTestUser);

    const data: Record<string, unknown> = {
      id: "abc-123",
      name: "Alice",
      "homeAddress.street": "123 Main St",
      "homeAddress.city": "Springfield",
      "homeAddress.zip": "62704",
      "workAddress.street": "456 Work Ave",
      "workAddress.city": "Shelbyville",
      "workAddress.zip": null,
    };

    const entity = defaultHydrateEntity<EmbeddedTestUser>(data, metadata, {
      snapshot: false,
      hooks: false,
    });

    expect(entity.name).toBe("Alice");
    expect(entity.homeAddress).toBeDefined();
    expect(entity.homeAddress!.street).toBe("123 Main St");
    expect(entity.homeAddress!.city).toBe("Springfield");
    expect(entity.workAddress!.street).toBe("456 Work Ave");
    expect(entity.workAddress!.zip).toBeNull();
  });

  test("should set embedded to null when all values are null", () => {
    const metadata = getEntityMetadata(EmbeddedTestUser);

    const data: Record<string, unknown> = {
      id: "abc-123",
      name: "Bob",
      "homeAddress.street": null,
      "homeAddress.city": null,
      "homeAddress.zip": null,
      "workAddress.street": null,
      "workAddress.city": null,
      "workAddress.zip": null,
    };

    const entity = defaultHydrateEntity<EmbeddedTestUser>(data, metadata, {
      snapshot: false,
      hooks: false,
    });

    expect(entity.homeAddress).toBeNull();
    expect(entity.workAddress).toBeNull();
  });

  test("should not leave dotted-key properties on the entity", () => {
    const metadata = getEntityMetadata(EmbeddedTestUser);

    const data: Record<string, unknown> = {
      id: "abc-123",
      name: "Alice",
      "homeAddress.street": "123 Main St",
      "homeAddress.city": "Springfield",
      "homeAddress.zip": null,
      "workAddress.street": null,
      "workAddress.city": null,
      "workAddress.zip": null,
    };

    const entity = defaultHydrateEntity<EmbeddedTestUser>(data, metadata, {
      snapshot: false,
      hooks: false,
    }) as any;

    expect(entity["homeAddress.street"]).toBeUndefined();
    expect(entity["homeAddress.city"]).toBeUndefined();
    expect(entity["workAddress.street"]).toBeUndefined();
  });
});

describe("Embedded — dehydration/hydration roundtrip", () => {
  test("should roundtrip with embedded data", () => {
    const metadata = getEntityMetadata(EmbeddedTestUser);

    const original = defaultCreateEntity(EmbeddedTestUser, {
      id: "roundtrip-1",
      name: "Alice",
      homeAddress: { street: "Main St", city: "Springfield", zip: "62704" },
      workAddress: null,
    } as any);

    const row = defaultDehydrateEntity(original, metadata, "insert");

    // Simulate what the driver does: map column names back to field keys
    const fieldKeyData: Record<string, unknown> = {};
    for (const field of metadata.fields) {
      if (field.name in row) {
        fieldKeyData[field.key] = row[field.name];
      }
    }

    const hydrated = defaultHydrateEntity<EmbeddedTestUser>(fieldKeyData, metadata, {
      snapshot: false,
      hooks: false,
    });

    expect(hydrated.name).toBe("Alice");
    expect(hydrated.homeAddress!.street).toBe("Main St");
    expect(hydrated.homeAddress!.city).toBe("Springfield");
    expect(hydrated.homeAddress!.zip).toBe("62704");
    expect(hydrated.workAddress).toBeNull();
  });
});

describe("Embedded — cloneEntity", () => {
  test("should deep-clone embedded objects", () => {
    const original = defaultCreateEntity(EmbeddedTestUser, {
      name: "Alice",
      homeAddress: { street: "123 Main", city: "Springfield", zip: "62704" },
    } as any);

    const cloned = defaultCloneEntity(EmbeddedTestUser, original);

    // Cloned entity should have embedded data
    expect(cloned.homeAddress).toBeDefined();
    expect(cloned.homeAddress!.street).toBe("123 Main");

    // Embedded objects should be separate instances (deep clone)
    if (original.homeAddress && cloned.homeAddress) {
      expect(cloned.homeAddress).not.toBe(original.homeAddress);
    }
  });

  test("should clone null embedded as null", () => {
    const original = defaultCreateEntity(EmbeddedTestUser, {
      name: "Bob",
      homeAddress: null,
    } as any);

    const cloned = defaultCloneEntity(EmbeddedTestUser, original);
    expect(cloned.homeAddress).toBeNull();
  });
});

describe("Embedded — validation", () => {
  test("should pass validation with valid embedded object", () => {
    const entity = defaultCreateEntity(EmbeddedCoordEntity, {
      id: "550e8400-e29b-41d4-a716-446655440000",
      location: { lat: 40.7, lng: -74.0 },
    } as any);

    expect(() => defaultValidateEntity(EmbeddedCoordEntity, entity)).not.toThrow();
  });

  test("should pass validation with null embedded", () => {
    const entity = defaultCreateEntity(EmbeddedCoordEntity, {
      id: "550e8400-e29b-41d4-a716-446655440001",
      location: null,
    } as any);

    expect(() => defaultValidateEntity(EmbeddedCoordEntity, entity)).not.toThrow();
  });
});
