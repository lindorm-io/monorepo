import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { hydrateReturning, hydrateReturningRows } from "./hydrate-returning";

class UserEntity {
  id: string = "";
  name: string = "";
  email: string = "";
  age: number = 0;
  balance: number = 0;
  counter: bigint = BigInt(0);
}

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  target: UserEntity,
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
    makeField("balance", { type: "decimal", name: "account_balance" }),
    makeField("counter", { type: "bigint" }),
  ],
  relations: [],
  primaryKeys: ["id"],
  hooks: [],
} as unknown as EntityMetadata;

describe("hydrateReturning", () => {
  test("should map column names to property keys", () => {
    const row = {
      id: "abc-123",
      name: "Alice",
      email_address: "alice@example.com",
      age: 30,
      account_balance: "99.99",
      counter: "12345678901234",
    };

    const result = hydrateReturning(row, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should coerce bigint string to BigInt", () => {
    const row = {
      id: "abc-123",
      name: "Alice",
      email_address: "alice@example.com",
      age: 30,
      account_balance: "10.0",
      counter: "9007199254740993",
    };

    const result = hydrateReturning(row, metadata);
    expect((result as any).counter).toBe(BigInt("9007199254740993"));
  });

  test("should preserve decimal as string (precision-safe)", () => {
    const row = {
      id: "abc-123",
      name: "Alice",
      email_address: "alice@example.com",
      age: 30,
      account_balance: "3.14",
      counter: "0",
    };

    const result = hydrateReturning(row, metadata);
    expect((result as any).balance).toBe("3.14");
  });

  test("should default missing columns to null", () => {
    const row = { id: "abc-123", name: "Alice" };
    const result = hydrateReturning(row, metadata);
    expect((result as any).email).toBeNull();
    expect((result as any).age).toBeNull();
  });
});

describe("hydrateReturningRows", () => {
  test("should hydrate multiple rows", () => {
    const rows = [
      {
        id: "1",
        name: "Alice",
        email_address: "a@b.com",
        age: 30,
        account_balance: "10.0",
        counter: "1",
      },
      {
        id: "2",
        name: "Bob",
        email_address: "b@b.com",
        age: 25,
        account_balance: "20.0",
        counter: "2",
      },
    ];

    const result = hydrateReturningRows(rows, metadata);
    expect(result).toHaveLength(2);
    expect((result[0] as any).name).toBe("Alice");
    expect((result[1] as any).name).toBe("Bob");
  });

  test("should return empty array for empty rows", () => {
    expect(hydrateReturningRows([], metadata)).toEqual([]);
  });
});
