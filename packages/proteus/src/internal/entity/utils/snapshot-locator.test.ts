import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field.js";
import {
  resolveSnapshotValue,
  snapshotLocatorForField,
  snapshotLocatorForJoinKey,
} from "./snapshot-locator.js";

const fields = [
  makeField("id", { type: "uuid" }),
  makeField("authorId", { type: "uuid", name: "author_id" }),
  makeField("address.street", {
    type: "string",
    name: "address_street",
    embedded: { parentKey: "address", constructor: () => Object },
  }),
];

describe("snapshotLocatorForField", () => {
  test("should locate a plain field by its property key", () => {
    expect(snapshotLocatorForField(fields[0])).toEqual({ kind: "field", key: "id" });
  });

  test("should locate an embedded field one level under the parent key", () => {
    expect(snapshotLocatorForField(fields[2])).toEqual({
      kind: "embedded",
      parentKey: "address",
      nestedKey: "street",
    });
  });
});

describe("snapshotLocatorForJoinKey", () => {
  test("should map a declared column to its property key", () => {
    expect(snapshotLocatorForJoinKey(fields, "author_id")).toEqual({
      kind: "join",
      propertyKey: "authorId",
      columnKey: "author_id",
    });
  });

  test("should camelCase an implicit FK column with no declared field", () => {
    expect(snapshotLocatorForJoinKey(fields, "parent_id")).toEqual({
      kind: "join",
      propertyKey: "parentId",
      columnKey: "parent_id",
    });
  });
});

describe("resolveSnapshotValue — field", () => {
  test("should read the value", () => {
    expect(resolveSnapshotValue({ id: "1" }, { kind: "field", key: "id" })).toEqual({
      present: true,
      value: "1",
    });
  });

  test("should report a stored null as present", () => {
    expect(resolveSnapshotValue({ id: null }, { kind: "field", key: "id" })).toEqual({
      present: true,
      value: null,
    });
  });

  test("should report a missing key as absent", () => {
    expect(resolveSnapshotValue({}, { kind: "field", key: "id" })).toEqual({
      present: false,
      value: undefined,
    });
  });
});

describe("resolveSnapshotValue — embedded", () => {
  const locator = {
    kind: "embedded",
    parentKey: "address",
    nestedKey: "street",
  } as const;

  test("should read one level down from the parent", () => {
    expect(resolveSnapshotValue({ address: { street: "Old St" } }, locator)).toEqual({
      present: true,
      value: "Old St",
    });
  });

  // Callers feed this straight into SQL params, where undefined binds wrong.
  test("should yield null, not undefined, when the parent is null", () => {
    expect(resolveSnapshotValue({ address: null }, locator)).toEqual({
      present: true,
      value: null,
    });
  });

  test("should report a missing parent as absent", () => {
    expect(resolveSnapshotValue({}, locator)).toEqual({ present: false, value: null });
  });
});

describe("resolveSnapshotValue — join", () => {
  const locator = {
    kind: "join",
    propertyKey: "authorId",
    columnKey: "author_id",
  } as const;

  test("should prefer the property key", () => {
    expect(resolveSnapshotValue({ authorId: "a-1", author_id: "a-2" }, locator)).toEqual({
      present: true,
      value: "a-1",
    });
  });

  test("should fall back to the column key", () => {
    expect(resolveSnapshotValue({ author_id: "a-2" }, locator)).toEqual({
      present: true,
      value: "a-2",
    });
  });

  // A snapshotted-null FK falls through to the column key, matching the `??`
  // the diff has always used — an unset FK reads the same either way.
  test("should fall through a null property key to the column key", () => {
    expect(resolveSnapshotValue({ authorId: null, author_id: "a-2" }, locator)).toEqual({
      present: true,
      value: "a-2",
    });
  });

  test("should report both keys missing as absent", () => {
    expect(resolveSnapshotValue({}, locator)).toEqual({
      present: false,
      value: undefined,
    });
  });
});

describe("resolveSnapshotValue — unknown locator", () => {
  test("should throw", () => {
    expect(() => resolveSnapshotValue({}, { kind: "nope" } as any)).toThrow();
  });
});
