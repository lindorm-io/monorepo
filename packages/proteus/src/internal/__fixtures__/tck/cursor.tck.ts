// TCK: Cursor Suite
// Tests cursor-based iteration.

import type { TckDriverHandle } from "./types";
import type { TckEntities } from "./create-tck-entities";
import { ProteusError } from "../../../errors/ProteusError";

export const cursorSuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  const { TckSimpleUser } = entities;

  beforeEach(async () => {
    await getHandle().clear();
    const repo = getHandle().repository(TckSimpleUser);
    for (let i = 1; i <= 10; i++) {
      await repo.insert({ name: `User${String(i).padStart(2, "0")}`, age: i * 10 });
    }
  });

  test("cursor iterates through all entities", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor({ orderBy: { name: "ASC" } });

    const results: string[] = [];
    let item = await cursor.next();
    while (item !== null) {
      results.push(item.name);
      item = await cursor.next();
    }
    await cursor.close();

    expect(results).toHaveLength(10);
    expect(results[0]).toBe("User01");
    expect(results[9]).toBe("User10");
  });

  test("cursor nextBatch returns batches", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor({ orderBy: { name: "ASC" }, batchSize: 3 });

    const batch1 = await cursor.nextBatch(3);
    expect(batch1).toHaveLength(3);
    expect(batch1[0].name).toBe("User01");

    const batch2 = await cursor.nextBatch(3);
    expect(batch2).toHaveLength(3);
    expect(batch2[0].name).toBe("User04");

    await cursor.close();
  });

  test("cursor supports async iteration", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor({ orderBy: { name: "ASC" } });

    const names: string[] = [];
    for await (const entity of cursor) {
      names.push(entity.name);
    }

    expect(names).toHaveLength(10);
  });

  test("cursor with where filters results", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor({
      where: { age: 30 },
      orderBy: { name: "ASC" },
    });

    const results: string[] = [];
    for await (const entity of cursor) {
      results.push(entity.name);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toBe("User03");
  });

  test("cursor on empty set returns null immediately", async () => {
    await getHandle().clear();
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor();

    const item = await cursor.next();
    expect(item).toBeNull();

    await cursor.close();
  });

  test("cursor close is idempotent", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor();

    await cursor.close();
    await expect(cursor.close()).resolves.toBeUndefined();
  });

  test("nextBatch returns empty array after exhaustion", async () => {
    // Re-seed with exactly 3 entities so nextBatch(10) exhausts the set in one call
    await getHandle().clear();
    const repo = getHandle().repository(TckSimpleUser);
    await repo.insert({ name: "Alpha", age: 10 });
    await repo.insert({ name: "Beta", age: 20 });
    await repo.insert({ name: "Gamma", age: 30 });

    const cursor = await repo.cursor({ orderBy: { name: "ASC" } });

    const batch1 = await cursor.nextBatch(10);
    expect(batch1).toHaveLength(3);

    const batch2 = await cursor.nextBatch(10);
    expect(batch2).toHaveLength(0);

    await cursor.close();
  });

  // ─── P4-F01: Closed cursor throws ProteusError ──────────────────────────────
  test("next() on a closed cursor throws a ProteusError", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor();

    await cursor.close();

    await expect(cursor.next()).rejects.toBeInstanceOf(ProteusError);
  });

  test("nextBatch() on a closed cursor throws a ProteusError", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor();

    await cursor.close();

    await expect(cursor.nextBatch(5)).rejects.toBeInstanceOf(ProteusError);
  });

  // ─── P4-F05: Resource cleanup on early break ────────────────────────────────
  test("breaking out of async iteration then executing a normal query succeeds", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor({ orderBy: { name: "ASC" } });

    for await (const _entity of cursor) {
      break;
    }

    // Repository must still function — verifies the pool client was released
    const count = await repo.count();
    expect(count).toBe(10);
  });

  // ─── P4-F05: Resource cleanup on error mid-iteration ────────────────────────
  test("error thrown inside for-await does not leak cursor resources", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor({ orderBy: { name: "ASC" } });

    let caught: Error | undefined;
    try {
      for await (const _entity of cursor) {
        throw new Error("Intentional mid-iteration error");
      }
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeDefined();
    expect(caught!.message).toBe("Intentional mid-iteration error");

    // Driver handle must remain usable after the cursor was abandoned
    const count = await repo.count();
    expect(count).toBe(10);
  });

  // ─── P4-F06: Concurrent next() calls ────────────────────────────────────────
  test("concurrent next() calls on the same cursor do not return duplicate entities", async () => {
    const repo = getHandle().repository(TckSimpleUser);
    const cursor = await repo.cursor({ orderBy: { name: "ASC" } });

    const [a, b] = await Promise.allSettled([cursor.next(), cursor.next()]);

    const successes = [a, b].filter((r) => r.status === "fulfilled");
    const failures = [a, b].filter((r) => r.status === "rejected");

    if (failures.length > 0) {
      // Rejecting concurrent calls is acceptable — must be ProteusError
      for (const f of failures) {
        expect((f as PromiseRejectedResult).reason).toBeInstanceOf(ProteusError);
      }
    } else {
      // Both succeeded — results must be distinct (not the same entity twice)
      const values = successes.map((s) => (s as PromiseFulfilledResult<any>).value);
      const nonNull = values.filter(Boolean);
      if (nonNull.length === 2) {
        expect(nonNull[0].id).not.toBe(nonNull[1].id);
      }
    }

    await cursor.close();
  });
};
