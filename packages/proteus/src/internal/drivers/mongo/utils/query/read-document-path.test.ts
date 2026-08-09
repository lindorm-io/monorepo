import { describe, expect, test } from "vitest";
import { documentKey, entityKey, readDocumentPath } from "./read-document-path.js";

describe("readDocumentPath", () => {
  test("reads a plain key", () => {
    expect(readDocumentPath({ author_id: "a1" }, "author_id")).toBe("a1");
  });

  // A composite primary key resolves to `_id.<fieldKey>`, which a filter
  // understands but a returned document does not carry as a property.
  test("reads one component of a compound id", () => {
    expect(readDocumentPath({ _id: { tenantId: "t1", id: "e1" } }, "_id.id")).toBe("e1");
  });

  test("reads through a missing segment without throwing", () => {
    expect(readDocumentPath({}, "_id.id")).toBeUndefined();
  });
});

describe("documentKey", () => {
  test("joins several key values into one comparable string", () => {
    expect(
      documentKey({ _id: { tenantId: "t1", id: "e1" } }, ["_id.tenantId", "_id.id"]),
    ).toMatchInlineSnapshot(`"t1|e1"`);
  });

  test("normalises a date so both sides of a match spell it the same", () => {
    expect(documentKey({ at: new Date("2020-01-02T03:04:05.006Z") }, ["at"])).toBe(
      "2020-01-02T03:04:05.006Z",
    );
  });

  // A join never matches on NULL, so a partly-null key matches nothing rather
  // than colliding with every other partly-null key.
  test("returns null when any part is nullish", () => {
    expect(documentKey({ a: "x", b: null }, ["a", "b"])).toBeNull();
    expect(documentKey({ a: "x" }, ["a", "b"])).toBeNull();
  });
});

describe("entityKey", () => {
  test("returns both the comparable key and the raw values to query with", () => {
    expect(entityKey({ tenantId: "t1", id: "e1" }, ["tenantId", "id"])).toEqual({
      key: "t1|e1",
      values: ["t1", "e1"],
    });
  });

  test("returns null when the entity holds no value for a key", () => {
    expect(entityKey({ authorId: null }, ["authorId"])).toBeNull();
  });
});
