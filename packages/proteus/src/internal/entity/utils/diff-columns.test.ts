import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "../types/metadata";
import { diffColumns } from "./diff-columns";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
    makeField("version", { type: "integer", decorator: "Version" }),
    makeField("createdAt", {
      type: "timestamp",
      decorator: "CreateDate",
      name: "created_at",
    }),
    makeField("updatedAt", {
      type: "timestamp",
      decorator: "UpdateDate",
      name: "updated_at",
    }),
    makeField("readonlyField", {
      type: "string",
      decorator: "Field",
      readonly: true,
      name: "readonly_field",
    }),
  ],
  primaryKeys: ["id"],
  generated: [],
  relations: [],
} as unknown as EntityMetadata;

describe("diffColumns", () => {
  test("should return null when nothing changed", () => {
    const entity = { id: "1", name: "Alice", email: "alice@test.com", age: 30 } as any;
    const snapshot = { id: "1", name: "Alice", email: "alice@test.com", age: 30 };
    expect(diffColumns(entity, metadata, snapshot)).toBeNull();
  });

  test("should return changed columns keyed by column name", () => {
    const entity = { id: "1", name: "Bob", email: "alice@test.com", age: 30 } as any;
    const snapshot = { id: "1", name: "Alice", email: "alice@test.com", age: 30 };
    const result = diffColumns(entity, metadata, snapshot);
    expect(result).toMatchSnapshot();
    expect(result).toHaveProperty("name", "Bob");
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("email_address");
  });

  test("should exclude PKs", () => {
    const entity = { id: "2", name: "Alice" } as any;
    const snapshot = { id: "1", name: "Alice" };
    expect(diffColumns(entity, metadata, snapshot)).toBeNull();
  });

  test("should exclude Version, UpdateDate, CreateDate", () => {
    const entity = {
      id: "1",
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    const snapshot = {
      id: "1",
      version: 1,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    expect(diffColumns(entity, metadata, snapshot)).toBeNull();
  });

  test("should exclude readonly user fields", () => {
    const entity = { id: "1", readonlyField: "changed" } as any;
    const snapshot = { id: "1", readonlyField: "original" };
    expect(diffColumns(entity, metadata, snapshot)).toBeNull();
  });

  test("should handle Date comparison", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date("2024-01-01");
    const d3 = new Date("2024-06-01");

    // Add a non-excluded date field
    const metaWithDate = {
      ...metadata,
      fields: [
        ...metadata.fields,
        makeField("eventDate", { type: "timestamp", name: "event_date" }),
      ],
    } as unknown as EntityMetadata;

    const entity1 = { id: "1", eventDate: d2 } as any;
    const snap1 = { id: "1", eventDate: d1 };
    expect(diffColumns(entity1, metaWithDate, snap1)).toBeNull(); // Same date

    const entity2 = { id: "1", eventDate: d3 } as any;
    expect(diffColumns(entity2, metaWithDate, snap1)).toMatchSnapshot();
  });

  test("should handle null-to-value change", () => {
    const entity = { id: "1", name: "Alice" } as any;
    const snapshot = { id: "1", name: null };
    const result = diffColumns(entity, metadata, snapshot);
    expect(result).toHaveProperty("name", "Alice");
  });

  test("should handle value-to-null change", () => {
    const entity = { id: "1", name: null } as any;
    const snapshot = { id: "1", name: "Alice" };
    const result = diffColumns(entity, metadata, snapshot);
    expect(result).toHaveProperty("name", null);
  });

  test("should treat null and undefined as equal", () => {
    const entity = { id: "1", name: null } as any;
    const snapshot = { id: "1", name: undefined };
    expect(diffColumns(entity, metadata, snapshot)).toBeNull();
  });

  test("should handle BigInt comparison", () => {
    const metaWithBigint = {
      ...metadata,
      fields: [...metadata.fields, makeField("counter", { type: "bigint" })],
    } as unknown as EntityMetadata;

    const entity = { id: "1", counter: BigInt(100) } as any;
    const snapshot = { id: "1", counter: BigInt(100) };
    expect(diffColumns(entity, metaWithBigint, snapshot)).toBeNull();

    const entity2 = { id: "1", counter: BigInt(200) } as any;
    expect(diffColumns(entity2, metaWithBigint, snapshot)).toHaveProperty(
      "counter",
      BigInt(200),
    );
  });

  test("should detect FK column changes via owning relations", () => {
    const metaWithRelation = {
      ...metadata,
      relations: [
        {
          key: "author",
          type: "ManyToOne",
          joinKeys: { authorId: "id" },
        },
      ],
    } as unknown as EntityMetadata;

    const entity = { id: "1", authorId: "user-2" } as any;
    const snapshot = { id: "1", authorId: "user-1" };
    const result = diffColumns(entity, metaWithRelation, snapshot);
    expect(result).toHaveProperty("authorId", "user-2");
  });

  test("should exclude generated increment fields", () => {
    const metaWithIncrement = {
      ...metadata,
      generated: [{ key: "seq", strategy: "increment" }],
      fields: [...metadata.fields, makeField("seq", { type: "integer" })],
    } as unknown as EntityMetadata;

    const entity = { id: "1", seq: 2 } as any;
    const snapshot = { id: "1", seq: 1 };
    expect(diffColumns(entity, metaWithIncrement, snapshot)).toBeNull();
  });
});

describe("diffColumns — embedded fields", () => {
  // An entity that has an embedded "address" value object.
  // After hydration, entity.address = { street, city } and
  // snapshot.address = { street, city }.
  // The metadata fields use dotted keys: "address.street", "address.city".

  class EmbeddedAddress {
    street: string = "";
    city: string = "";
  }

  const embeddedMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("address.street", {
        type: "string",
        name: "address_street",
        embedded: { parentKey: "address", constructor: () => EmbeddedAddress },
      }),
      makeField("address.city", {
        type: "string",
        name: "address_city",
        embedded: { parentKey: "address", constructor: () => EmbeddedAddress },
      }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
  } as unknown as EntityMetadata;

  test("should detect change in nested embedded field", () => {
    const entity = { id: "1", address: { street: "New St", city: "Springfield" } } as any;
    const snapshot = { id: "1", address: { street: "Old St", city: "Springfield" } };
    const result = diffColumns(entity, embeddedMetadata, snapshot);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("address_street", "New St");
    expect(result).not.toHaveProperty("address_city");
  });

  test("should return null when embedded fields are unchanged", () => {
    const entity = {
      id: "1",
      address: { street: "Main St", city: "Springfield" },
    } as any;
    const snapshot = { id: "1", address: { street: "Main St", city: "Springfield" } };
    expect(diffColumns(entity, embeddedMetadata, snapshot)).toBeNull();
  });

  test("should detect change when all embedded fields change", () => {
    const entity = { id: "1", address: { street: "New St", city: "Shelbyville" } } as any;
    const snapshot = { id: "1", address: { street: "Old St", city: "Springfield" } };
    const result = diffColumns(entity, embeddedMetadata, snapshot);
    expect(result).toMatchSnapshot();
    expect(result).toHaveProperty("address_street", "New St");
    expect(result).toHaveProperty("address_city", "Shelbyville");
  });

  test("should detect change when entity embedded is null and snapshot has values", () => {
    // When entity.address is null, parts.reduce produces undefined (null?.[part] = undefined)
    // valuesEqual(undefined, "Old St") = false → detected as a change
    // changed[field.name] = undefined (the current value from the traversal)
    const entity = { id: "1", address: null } as any;
    const snapshot = { id: "1", address: { street: "Old St", city: "Springfield" } };
    const result = diffColumns(entity, embeddedMetadata, snapshot);
    expect(result).not.toBeNull();
    // The values stored in changed are undefined (result of null?.[part])
    // The key is the field name (column name), not the dotted field key
    expect(Object.keys(result!)).toContain("address_street");
    expect(Object.keys(result!)).toContain("address_city");
  });

  test("should return null when both entity and snapshot embedded are null", () => {
    const entity = { id: "1", address: null } as any;
    const snapshot = { id: "1", address: null };
    expect(diffColumns(entity, embeddedMetadata, snapshot)).toBeNull();
  });

  test("should return null when both entity embedded is undefined and snapshot is null", () => {
    // undefined and null are treated as equal (no value)
    const entity = { id: "1", address: undefined } as any;
    const snapshot = { id: "1", address: null };
    expect(diffColumns(entity, embeddedMetadata, snapshot)).toBeNull();
  });

  test("should detect embedded object appearing (null → value)", () => {
    const entity = { id: "1", address: { street: "First St", city: "Newtown" } } as any;
    const snapshot = { id: "1", address: null };
    const result = diffColumns(entity, embeddedMetadata, snapshot);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("address_street", "First St");
    expect(result).toHaveProperty("address_city", "Newtown");
  });

  test("should produce null (not undefined) values when entity embedded parent is null", () => {
    // B6: embedded field traversal must yield null, not undefined, when the parent is null.
    // SQL parameter binding treats null correctly; undefined would cause silent failures.
    const entity = { id: "1", address: null } as any;
    const snapshot = { id: "1", address: { street: "Old St", city: "Springfield" } };
    const result = diffColumns(entity, embeddedMetadata, snapshot);
    expect(result).not.toBeNull();
    // The changed values must be strictly null, not undefined
    expect(result!["address_street"]).toBeNull();
    expect(result!["address_city"]).toBeNull();
    // Confirm undefined is NOT present
    expect(result!["address_street"]).not.toBeUndefined();
    expect(result!["address_city"]).not.toBeUndefined();
  });
});
