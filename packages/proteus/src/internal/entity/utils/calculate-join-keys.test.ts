import { calculateJoinKeys } from "./calculate-join-keys";
import type { EntityMetadata } from "../types/metadata";

const makePrimaryMeta = (
  primaryKeys: Array<string>,
  overrides: Partial<Omit<EntityMetadata, "relations">> = {},
): Omit<EntityMetadata, "relations"> =>
  ({
    target: class TestEntity {},
    checks: [],
    entity: {
      decorator: "Entity",
      cache: null,
      comment: null,
      database: null,
      name: "TestEntity",
      namespace: null,
    },
    extras: [],
    fields: primaryKeys.map((key) => ({
      key,
      decorator: "Field",
      comment: null,
      computed: null,
      enum: null,
      default: null,
      max: null,
      min: null,
      nullable: false,

      readonly: false,
      schema: null,
      type: "uuid",
    })),
    generated: [],
    hooks: [],
    indexes: [],
    primaryKeys,
    schemas: [],
    uniques: [],
    versionKeys: [],
    ...overrides,
  }) as Omit<EntityMetadata, "relations">;

describe("calculateJoinKeys", () => {
  test("should calculate join keys from single primary key", () => {
    const meta = makePrimaryMeta(["id"]);
    expect(calculateJoinKeys({ key: "author" }, meta)).toMatchSnapshot();
  });

  test("should calculate join keys from composite primary keys", () => {
    const meta = makePrimaryMeta(["tenantId", "userId"]);
    expect(calculateJoinKeys({ key: "owner" }, meta)).toMatchSnapshot();
  });

  test("should apply snake_case to relation key prefix", () => {
    const meta = makePrimaryMeta(["id"]);
    const result = calculateJoinKeys({ key: "primaryAuthor" }, meta);
    expect(result).toMatchSnapshot();
  });

  test("should return empty dict for empty primary keys", () => {
    const meta = makePrimaryMeta([]);
    expect(calculateJoinKeys({ key: "author" }, meta)).toEqual({});
  });
});
