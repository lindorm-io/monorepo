import type { MongoTransactionHandle } from "../types/mongo-types.js";
import { MongoTransactionContext } from "./MongoTransactionContext.js";
import { describe, expect, it } from "vitest";

const makeHandle = (): MongoTransactionHandle =>
  ({
    session: { id: "fake-session" } as any,
    state: "active",
  }) as MongoTransactionHandle;

const makeDriver = () => ({}) as any;

describe("MongoTransactionContext.client", () => {
  it("returns the ClientSession from the handle", async () => {
    const handle = makeHandle();
    const ctx = new MongoTransactionContext(handle, makeDriver());

    const client = await ctx.client<typeof handle.session>();

    expect(client).toBe(handle.session);
  });

  it("returns undefined when the handle has no session (shouldn't happen in practice)", async () => {
    const handle: MongoTransactionHandle = { session: undefined, state: "active" };
    const ctx = new MongoTransactionContext(handle, makeDriver());

    const client = await ctx.client<typeof handle.session>();

    expect(client).toBeUndefined();
  });
});
