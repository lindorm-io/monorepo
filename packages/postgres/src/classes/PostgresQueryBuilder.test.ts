import { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

type Attribute = {
  one: string;
  two: number;
  three: boolean;
  four: Array<string>;
  five: Array<Dict>;
  six: Dict;
  seven: Date;
};

describe("PostgresQueryBuilder", () => {
  let queryBuilder: PostgresQueryBuilder<Attribute>;

  beforeAll(() => {
    queryBuilder = new PostgresQueryBuilder<Attribute>({
      table: "my_table_name",
    });
  });

  describe("constructor", () => {
    test("should throw on invalid table name", () => {
      expect(() => new PostgresQueryBuilder({ table: "" })).toThrow();

      expect(() => new PostgresQueryBuilder({ table: "invalid table name" })).toThrow();
    });
  });

  describe("delete", () => {
    test("should create a query to delete", () => {
      expect(queryBuilder.delete({ one: "General", two: 123 })).toEqual({
        text: 'DELETE FROM "my_table_name" WHERE "one" = ? AND "two" = ?',
        values: ["General", 123],
      });
    });
  });

  describe("insert", () => {
    test("should create an insert query", () => {
      expect(
        queryBuilder.insert(
          {
            one: "General",
            two: 2,
            three: true,
            four: ["Four"],
            five: [{ five: "Five" }],
            six: { six: "Six" },
            seven: new Date(),
          },
          {
            returning: ["five", "six"],
          },
        ),
      ).toEqual({
        text: 'INSERT INTO "my_table_name" ("one", "two", "three", "four", "five", "six", "seven") VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING "five", "six"',
        values: [
          "General",
          2,
          true,
          ["Four"],
          [{ five: "Five" }],
          { six: "Six" },
          MockedDate,
        ],
      });
    });

    test("should create a multiple insert query", () => {
      expect(
        queryBuilder.insertMany(
          [
            {
              one: "General",
              two: 2,
              three: true,
              four: ["Four"],
              five: [{ five: "Five" }],
              six: { six: "Six" },
              seven: new Date(),
            },
            {
              one: "Kenobi",
              two: 4,
              three: false,
              four: ["Five", "Six", "Seven", "Eight"],
              five: [{ something: { else: true } }],
              six: { is: { an_object: 1 } },
              seven: new Date(),
            },
          ],
          { returning: true },
        ),
      ).toEqual({
        text: 'INSERT INTO "my_table_name" ("one", "two", "three", "four", "five", "six", "seven") VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?) RETURNING *',
        values: [
          "General",
          2,
          true,
          ["Four"],
          [{ five: "Five" }],
          { six: "Six" },
          MockedDate,

          "Kenobi",
          4,
          false,
          ["Five", "Six", "Seven", "Eight"],
          [{ something: { else: true } }],
          { is: { an_object: 1 } },
          MockedDate,
        ],
      });
    });

    test("should throw on invalid attributes", () => {
      expect(() => queryBuilder.insertMany([])).toThrow();

      expect(() =>
        queryBuilder.insertMany([
          // @ts-expect-error
          123,
        ]),
      ).toThrow();

      expect(() =>
        queryBuilder.insert(
          // @ts-expect-error
          {},
        ),
      ).toThrow();

      expect(() =>
        // @ts-expect-error
        queryBuilder.insertMany([{ one: 1, two: 1 }, { one: 1 }]),
      ).toThrow();

      expect(() =>
        queryBuilder.insertMany([
          // @ts-expect-error
          { one: 1, two: 1 },
          // @ts-expect-error
          { one: 1, two: 1, three: 1 },
        ]),
      ).toThrow();
    });
  });

  describe("select", () => {
    test("should create a select query", () => {
      expect(queryBuilder.select({ one: "General" })).toEqual({
        text: 'SELECT * FROM "my_table_name" WHERE "one" = ?',
        values: ["General"],
      });
    });

    test("should create a select query with all options", () => {
      expect(
        queryBuilder.select(
          { one: "General", two: 15 },
          {
            distinct: true,
            columns: ["one", "two"],
            limit: 10,
            offset: 5,
            order: {
              one: "ASC",
              two: "DESC",
            },
          },
        ),
      ).toEqual({
        text: 'SELECT DISTINCT "one", "two" FROM "my_table_name" WHERE "one" = ? AND "two" = ? ORDER BY "one" ASC, "two" DESC LIMIT ? OFFSET ?',
        values: ["General", 15, 10, 5],
      });
    });
  });

  describe("update", () => {
    test("should create an update query", () => {
      expect(queryBuilder.update({ one: "General" }, { two: 15 })).toEqual({
        text: 'UPDATE "my_table_name" SET "two" = ? WHERE "one" = ?',
        values: [15, "General"],
      });
    });

    test("should create an update query with options", () => {
      expect(
        queryBuilder.update(
          { one: "General", two: 15 },
          { two: 15 },
          { returning: ["one", "two"] },
        ),
      ).toEqual({
        text: 'UPDATE "my_table_name" SET "two" = ? WHERE "one" = ? AND "two" = ? RETURNING "one", "two"',
        values: [15, "General", 15],
      });
    });
  });

  describe("upsert", () => {
    test("should create an upsert query", () => {
      expect(
        queryBuilder.upsert(
          { one: "General" },
          { two: 15, three: true },
          { returning: ["one", "two"] },
        ),
      ).toEqual({
        text: 'INSERT INTO "my_table_name" ("two", "three") VALUES (?, ?) ON CONFLICT ("one") DO UPDATE SET "two" = EXCLUDED."two", "three" = EXCLUDED."three" RETURNING "one", "two"',
        values: [15, true],
      });
    });
  });
});
