import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { ProteusError } from "../../../../../errors/ProteusError";
import {
  compileDelete,
  compileDeleteExpired,
  compileRestore,
  compileSoftDelete,
} from "./compile-delete";

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("deletedAt", {
      type: "timestamp",
      decorator: "DeleteDate",
      name: "deleted_at",
    }),
    makeField("expiresAt", {
      type: "timestamp",
      decorator: "ExpiryDate",
      name: "expires_at",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

describe("compileDelete", () => {
  test("should compile hard delete with criteria", () => {
    const result = compileDelete({ id: "abc-123" } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should use table alias t0", () => {
    const result = compileDelete({ id: "abc-123" } as any, metadata);
    expect(result.text).toContain('AS "t0"');
  });
});

describe("compileSoftDelete", () => {
  test("should compile soft delete with NOW()", () => {
    const result = compileSoftDelete({ id: "abc-123" } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should set DeleteDate field to NOW()", () => {
    const result = compileSoftDelete({ id: "abc-123" } as any, metadata);
    expect(result.text).toContain('"deleted_at" = NOW()');
  });

  test("should throw ProteusError when entity has no @DeleteDate field", () => {
    const noDeleteDateMetadata = {
      entity: {
        decorator: "Entity",
        cache: null,
        comment: null,
        database: null,
        name: "events",
        namespace: "app",
      },
      fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
      relations: [],
      primaryKeys: ["id"],
      generated: [],
    } as unknown as EntityMetadata;

    expect(() =>
      compileSoftDelete({ id: "abc-123" } as any, noDeleteDateMetadata),
    ).toThrow(ProteusError);
  });
});

describe("compileRestore", () => {
  test("should compile restore setting DeleteDate to NULL", () => {
    const result = compileRestore({ id: "abc-123" } as any, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should set DeleteDate field to NULL", () => {
    const result = compileRestore({ id: "abc-123" } as any, metadata);
    expect(result.text).toContain('"deleted_at" = NULL');
  });

  test("should throw ProteusError when entity has no @DeleteDate field", () => {
    const noDeleteDateMetadata = {
      entity: {
        decorator: "Entity",
        cache: null,
        comment: null,
        database: null,
        name: "events",
        namespace: "app",
      },
      fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
      relations: [],
      primaryKeys: ["id"],
      generated: [],
    } as unknown as EntityMetadata;

    expect(() => compileRestore({ id: "abc-123" } as any, noDeleteDateMetadata)).toThrow(
      ProteusError,
    );
  });
});

describe("compileDeleteExpired", () => {
  test("should compile delete expired with NOW()", () => {
    const result = compileDeleteExpired(metadata);
    expect(result).toMatchSnapshot();
  });

  test("should use ExpiryDate field in WHERE", () => {
    const result = compileDeleteExpired(metadata);
    expect(result.text).toContain('"expires_at" <= NOW()');
  });

  test("should have no params", () => {
    const result = compileDeleteExpired(metadata);
    expect(result.params).toEqual([]);
  });

  test("should throw ProteusError when entity has no @ExpiryDate field", () => {
    const noExpiryDateMetadata = {
      entity: {
        decorator: "Entity",
        cache: null,
        comment: null,
        database: null,
        name: "events",
        namespace: "app",
      },
      fields: [makeField("id", { type: "uuid" }), makeField("name", { type: "string" })],
      relations: [],
      primaryKeys: ["id"],
      generated: [],
    } as unknown as EntityMetadata;

    expect(() => compileDeleteExpired(noExpiryDateMetadata)).toThrow(ProteusError);
  });
});
