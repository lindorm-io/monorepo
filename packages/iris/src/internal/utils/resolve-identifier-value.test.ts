import type { MessageMetadata, MetaField } from "../message/types/metadata";
import { resolveIdentifierValue } from "./resolve-identifier-value";
import { describe, expect, it } from "vitest";

const makeField = (overrides: Partial<MetaField>): MetaField => ({
  key: "id",
  decorator: "Field",
  default: null,
  enum: null,
  max: null,
  min: null,
  nullable: false,
  optional: false,
  schema: null,
  transform: null,
  type: "string",
  ...overrides,
});

const makeMetadata = (fields: Array<MetaField>): MessageMetadata =>
  ({ fields }) as unknown as MessageMetadata;

describe("resolveIdentifierValue", () => {
  it("should return the identifier field value when present", () => {
    const metadata = makeMetadata([
      makeField({ key: "id", decorator: "IdentifierField", type: "uuid" }),
      makeField({ key: "name", decorator: "Field", type: "string" }),
    ]);
    const message = { id: "abc-123", name: "test" };

    expect(resolveIdentifierValue(message, metadata)).toBe("abc-123");
  });

  it("should return null when no IdentifierField is defined", () => {
    const metadata = makeMetadata([
      makeField({ key: "name", decorator: "Field", type: "string" }),
    ]);
    const message = { name: "test" };

    expect(resolveIdentifierValue(message, metadata)).toBeNull();
  });

  it("should return null when identifier field value is null", () => {
    const metadata = makeMetadata([
      makeField({ key: "id", decorator: "IdentifierField", type: "uuid" }),
    ]);
    const message = { id: null };

    expect(resolveIdentifierValue(message, metadata)).toBeNull();
  });

  it("should return null when identifier field value is undefined", () => {
    const metadata = makeMetadata([
      makeField({ key: "id", decorator: "IdentifierField", type: "uuid" }),
    ]);
    const message = {};

    expect(resolveIdentifierValue(message, metadata)).toBeNull();
  });

  it("should convert non-string values to string", () => {
    const metadata = makeMetadata([
      makeField({ key: "id", decorator: "IdentifierField", type: "integer" }),
    ]);
    const message = { id: 42 };

    expect(resolveIdentifierValue(message, metadata)).toBe("42");
  });
});
