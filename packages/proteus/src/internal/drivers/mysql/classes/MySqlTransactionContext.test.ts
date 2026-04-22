import type { MysqlTransactionHandle } from "../types/mysql-transaction-handle.js";
import { MySqlTransactionContext } from "./MySqlTransactionContext.js";
import { describe, expect, it, vi } from "vitest";

const makeHandle = (): MysqlTransactionHandle => {
  const queries: Array<string> = [];
  return {
    client: {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [{ id: 1 }], rowCount: 1, insertId: 0 };
      }),
    },
    connection: {},
    release: vi.fn(),
    state: "active" as const,
    savepointCounter: 0,
    __queries: queries,
  } as any;
};

describe("MySqlTransactionContext.client", () => {
  it("returns the transaction-scoped MysqlQueryClient from the handle", async () => {
    const handle = makeHandle();
    const ctx = new MySqlTransactionContext(handle);

    const client = await ctx.client<typeof handle.client>();

    expect(client).toBe(handle.client);
  });

  it("returns a client whose query() routes through the tx handle's client", async () => {
    const handle = makeHandle();
    const ctx = new MySqlTransactionContext(handle);

    const client = await ctx.client<typeof handle.client>();
    const result = await client.query("SELECT 1");

    expect(result.rows).toEqual([{ id: 1 }]);
    const queries = (handle as any).__queries as Array<string>;
    expect(queries).toContain("SELECT 1");
  });
});
