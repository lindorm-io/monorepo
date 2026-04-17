import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { pgDehydrateEntity } from "./pg-dehydrate-entity";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("counter", { type: "bigint" }),
  ],
  primaryKeys: ["id"],
  generated: [],
  relations: [],
} as unknown as EntityMetadata;

describe("pgDehydrateEntity", () => {
  test("should return Array<DehydratedColumn>", () => {
    const entity = { id: "abc", name: "Alice", counter: BigInt(42) } as any;
    const result = pgDehydrateEntity(entity, metadata, "insert");
    expect(result).toMatchSnapshot();
  });

  test("should coerce bigint to string via coerceWriteValue", () => {
    const entity = {
      id: "abc",
      name: "Alice",
      counter: BigInt("9007199254740993"),
    } as any;
    const result = pgDehydrateEntity(entity, metadata, "insert");
    const counterCol = result.find((c) => c.column === "counter");
    expect(counterCol?.value).toBe("9007199254740993");
  });

  test("should preserve null values", () => {
    const entity = { id: "abc", name: null, counter: null } as any;
    const result = pgDehydrateEntity(entity, metadata, "insert");
    const nameCol = result.find((c) => c.column === "name");
    expect(nameCol?.value).toBeNull();
  });

  test("should skip PKs in update mode", () => {
    const entity = { id: "abc", name: "Alice", counter: BigInt(0) } as any;
    const result = pgDehydrateEntity(entity, metadata, "update");
    const idCol = result.find((c) => c.column === "id");
    expect(idCol).toBeUndefined();
  });

  test("should include PKs in insert mode", () => {
    const entity = { id: "abc", name: "Alice", counter: BigInt(0) } as any;
    const result = pgDehydrateEntity(entity, metadata, "insert");
    const idCol = result.find((c) => c.column === "id");
    expect(idCol).toBeDefined();
  });
});

describe("pgDehydrateEntity — embedded fields", () => {
  // Fields with embedded.parentKey read from a nested object on the entity.
  // key is "address.street", name is the column name ("street"), parentKey is "address".
  const embeddedMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("address.street", {
        name: "street",
        type: "string",
        embedded: { parentKey: "address", constructor: () => Object as any },
      }),
      makeField("address.city", {
        name: "city",
        type: "string",
        embedded: { parentKey: "address", constructor: () => Object as any },
      }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
  } as unknown as EntityMetadata;

  test("should read embedded fields from nested object in insert mode", () => {
    const entity = {
      id: "abc",
      address: { street: "123 Main St", city: "Springfield" },
    } as any;
    const result = pgDehydrateEntity(entity, embeddedMetadata, "insert");
    expect(result).toMatchSnapshot();
  });

  test("should produce null for embedded fields when parent object is null", () => {
    const entity = { id: "abc", address: null } as any;
    const result = pgDehydrateEntity(entity, embeddedMetadata, "insert");
    expect(result).toMatchSnapshot();
  });

  test("should produce null for embedded fields when parent object is undefined", () => {
    const entity = { id: "abc" } as any;
    const result = pgDehydrateEntity(entity, embeddedMetadata, "insert");
    expect(result).toMatchSnapshot();
  });
});

describe("pgDehydrateEntity — readonly fields", () => {
  // readonly: true + decorator: "Field" causes the field to be skipped in update mode.
  // In insert mode the field is included normally.
  const readonlyMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("slug", { type: "string", readonly: true }),
      makeField("name", { type: "string" }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
  } as unknown as EntityMetadata;

  test("should include readonly fields in insert mode", () => {
    const entity = { id: "abc", slug: "alice-smith", name: "Alice" } as any;
    const result = pgDehydrateEntity(entity, readonlyMetadata, "insert");
    expect(result).toMatchSnapshot();
  });

  test("should exclude readonly fields in update mode", () => {
    const entity = { id: "abc", slug: "alice-smith", name: "Alice" } as any;
    const result = pgDehydrateEntity(entity, readonlyMetadata, "update");
    expect(result).toMatchSnapshot();
  });
});

describe("pgDehydrateEntity — CreateDate fields", () => {
  // Fields with decorator "CreateDate" are skipped during update mode only.
  const createDateMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("createdAt", { decorator: "CreateDate", type: "timestamp" }),
      makeField("name", { type: "string" }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
  } as unknown as EntityMetadata;

  test("should include CreateDate fields in insert mode", () => {
    const entity = {
      id: "abc",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      name: "Alice",
    } as any;
    const result = pgDehydrateEntity(entity, createDateMetadata, "insert");
    expect(result).toMatchSnapshot();
  });

  test("should skip CreateDate fields in update mode", () => {
    const entity = {
      id: "abc",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      name: "Alice",
    } as any;
    const result = pgDehydrateEntity(entity, createDateMetadata, "update");
    expect(result).toMatchSnapshot();
  });
});

describe("pgDehydrateEntity — transform functions", () => {
  // When a field has a transform, its `.to` function is applied before the value
  // is passed to coerceWriteValue. This test verifies the transform is called and
  // coerceWriteValue still runs on the transformed output.
  const uppercaseTransform = {
    to: (v: unknown) => (typeof v === "string" ? v.toUpperCase() : v),
    from: (v: unknown) => (typeof v === "string" ? v.toLowerCase() : v),
  };

  const jsonTransform = {
    to: (v: unknown) => JSON.stringify(v),
    from: (v: unknown) => JSON.parse(v as string),
  };

  const transformMetadata = {
    fields: [
      makeField("id", { type: "uuid" }),
      makeField("code", { type: "string", transform: uppercaseTransform }),
      makeField("payload", { type: "json", transform: jsonTransform }),
    ],
    primaryKeys: ["id"],
    generated: [],
    relations: [],
  } as unknown as EntityMetadata;

  test("should apply transform.to before writing the value", () => {
    const entity = {
      id: "abc",
      code: "hello-world",
      payload: { key: "value", count: 3 },
    } as any;
    const result = pgDehydrateEntity(entity, transformMetadata, "insert");
    expect(result).toMatchSnapshot();
  });

  test("should apply transform.to in update mode as well", () => {
    const entity = {
      id: "abc",
      code: "hello-world",
      payload: { key: "value", count: 3 },
    } as any;
    const result = pgDehydrateEntity(entity, transformMetadata, "update");
    expect(result).toMatchSnapshot();
  });

  test("should not apply transform when value is null", () => {
    // defaultDehydrateEntity only calls transform when value != null
    const entity = { id: "abc", code: null, payload: null } as any;
    const result = pgDehydrateEntity(entity, transformMetadata, "insert");
    expect(result).toMatchSnapshot();
  });
});
