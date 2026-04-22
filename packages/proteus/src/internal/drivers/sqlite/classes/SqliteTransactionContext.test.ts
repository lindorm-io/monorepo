import type { SqliteTransactionHandle } from "../types/sqlite-transaction-handle.js";
import { SqliteTransactionContext } from "./SqliteTransactionContext.js";
import { describe, expect, it, vi } from "vitest";

const makeHandle = (): SqliteTransactionHandle => {
  const executed: Array<string> = [];
  return {
    client: {
      all: vi.fn((sql: string) => {
        executed.push(sql);
        return [{ id: 1 }];
      }),
      run: vi.fn(),
      get: vi.fn(),
      exec: vi.fn(),
      iterate: vi.fn(),
      close: vi.fn(),
      open: true,
      name: ":memory:",
    },
    state: "active" as const,
    savepointCounter: 0,
    __executed: executed,
  } as any;
};

describe("SqliteTransactionContext.client", () => {
  it("returns the transaction-scoped SqliteQueryClient from the handle", async () => {
    const handle = makeHandle();
    const ctx = new SqliteTransactionContext(handle);

    const client = await ctx.client<typeof handle.client>();

    expect(client).toBe(handle.client);
  });

  it("returns a client whose all() routes through the tx handle's client", async () => {
    const handle = makeHandle();
    const ctx = new SqliteTransactionContext(handle);

    const client = await ctx.client<typeof handle.client>();
    const rows = client.all("SELECT 1");

    expect(rows).toEqual([{ id: 1 }]);
    const executed = (handle as any).__executed as Array<string>;
    expect(executed).toContain("SELECT 1");
  });
});
