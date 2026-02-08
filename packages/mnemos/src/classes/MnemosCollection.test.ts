import { TEST_PEOPLE, TestPerson } from "../__fixtures__/test-people";
import { IMnemosCollection } from "../interfaces";
import { MnemosCollection } from "./MnemosCollection";

describe("MnemosCollection", () => {
  let collection: IMnemosCollection<TestPerson>;

  beforeEach(() => {
    collection = new MnemosCollection<TestPerson>({
      metadata: {
        columns: [
          {
            key: "name",
            decorator: "Column",
            enum: null,
            fallback: null,
            max: null,
            min: null,
            nullable: true,
            optional: false,
            readonly: false,
            schema: null,
            type: "string",
          },
        ],
        entity: {
          cache: null,
          database: null,
          decorator: "Entity",
          name: "test",
          namespace: null,
        },
        extras: [],
        generated: [],
        hooks: [],
        indexes: [
          {
            keys: [{ key: "id", direction: "asc" }],
            name: null,
            options: {},
            unique: true,
          },
          {
            keys: [{ key: "name", direction: "asc" }],
            name: null,
            options: {},
            unique: true,
          },
        ],
        primaryKeys: ["id"],
        primarySource: null,
        relations: [],
        schemas: [],
        target: {} as any,
      },
    });
    collection.insertOne(TEST_PEOPLE[0]);
  });

  describe("delete", () => {
    test("should delete entity", () => {
      expect(collection.delete({ id: TEST_PEOPLE[0].id })).toBeUndefined();

      expect(
        // @ts-expect-error
        collection.state,
      ).toHaveLength(0);
    });
  });

  describe("find", () => {
    test("should find entity", () => {
      expect(collection.find({ id: TEST_PEOPLE[0].id })).toEqual(TEST_PEOPLE[0]);
    });

    test("should return undefined if not found", () => {
      expect(collection.find({ id: "unknown" })).toBeUndefined();
    });
  });

  describe("filter", () => {
    test("should filter entities", () => {
      expect(collection.filter()).toEqual([TEST_PEOPLE[0]]);
    });

    test("should filter entities by predicate", () => {
      expect(collection.filter({ id: TEST_PEOPLE[0].id })).toEqual([TEST_PEOPLE[0]]);
    });

    test("should return empty array if not found", () => {
      expect(collection.filter({ id: "unknown" })).toEqual([]);
    });
  });

  describe("insert", () => {
    test("should insert entity", () => {
      expect(collection.insertOne(TEST_PEOPLE[1])).toBeDefined();
      expect(
        // @ts-expect-error
        collection.state,
      ).toHaveLength(2);
    });

    test("should throw on duplicate id", () => {
      expect(() => collection.insertOne(TEST_PEOPLE[0])).toThrow();
      expect(
        // @ts-expect-error
        collection.state,
      ).toHaveLength(1);
    });
  });

  describe("update", () => {
    test("should update entity", () => {
      expect(
        collection.update({ id: TEST_PEOPLE[0].id }, TEST_PEOPLE[1]),
      ).toBeUndefined();
      expect(
        // @ts-expect-error
        collection.state,
      ).toHaveLength(1);
      expect(
        // @ts-expect-error
        collection.state,
      ).toEqual([TEST_PEOPLE[1]]);
    });

    test("should update entity and keep insert order", () => {
      collection.insertOne(TEST_PEOPLE[1]);
      collection.insertOne(TEST_PEOPLE[2]);

      expect(
        collection.update({ id: TEST_PEOPLE[1].id }, TEST_PEOPLE[3]),
      ).toBeUndefined();
      expect(
        // @ts-expect-error
        collection.state,
      ).toHaveLength(3);
      expect(
        // @ts-expect-error
        collection.state,
      ).toEqual([TEST_PEOPLE[0], TEST_PEOPLE[3], TEST_PEOPLE[2]]);
    });

    test("should throw if not found", () => {
      expect(() => collection.update({ id: "unknown" }, TEST_PEOPLE[1])).toThrow();
    });
  });
});
