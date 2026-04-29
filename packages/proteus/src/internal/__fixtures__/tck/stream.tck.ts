import { describe, test, expect, beforeEach } from "vitest";
// TCK: Stream Suite
// Verifies that stream() returns an AsyncIterable that yields entities.

import type { TckDriverHandle } from "./types.js";
import type { TckEntities } from "./create-tck-entities.js";

export const streamSuite = (getHandle: () => TckDriverHandle, entities: TckEntities) => {
  describe("Stream", () => {
    const { TckSimpleUser } = entities;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("stream yields all entities via for-await", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "Alice", age: 25 });
      await repo.insert({ name: "Bob", age: 30 });
      await repo.insert({ name: "Charlie", age: 35 });

      const collected: Array<any> = [];
      for await (const entity of repo.stream()) {
        collected.push(entity);
      }

      expect(collected).toHaveLength(3);
      expect(collected.map((e) => e.name).sort()).toEqual(["Alice", "Bob", "Charlie"]);
    });

    test("stream with where filter", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "Alice", age: 25 });
      await repo.insert({ name: "Bob", age: 30 });
      await repo.insert({ name: "Charlie", age: 35 });

      const collected: Array<any> = [];
      for await (const entity of repo.stream({ where: { age: { $gte: 30 } } })) {
        collected.push(entity);
      }

      expect(collected).toHaveLength(2);
    });

    test("stream returns empty iterable for no results", async () => {
      const repo = getHandle().repository(TckSimpleUser);

      const collected: Array<any> = [];
      for await (const entity of repo.stream()) {
        collected.push(entity);
      }

      expect(collected).toHaveLength(0);
    });

    test("stream can be broken out of early", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      for (let i = 0; i < 10; i++) {
        await repo.insert({ name: `User${i}`, age: i });
      }

      const collected: Array<any> = [];
      for await (const entity of repo.stream()) {
        collected.push(entity);
        if (collected.length >= 3) break;
      }

      expect(collected).toHaveLength(3);
    });

    // ─── Resource cleanup: early break then subsequent query ───────────────────
    test("breaking out of stream() early does not block subsequent queries", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      for (let i = 0; i < 5; i++) {
        await repo.insert({ name: `StreamBreak${i}`, age: i });
      }

      const seen: string[] = [];
      for await (const entity of repo.stream()) {
        seen.push(entity.name);
        if (seen.length >= 2) break;
      }

      expect(seen).toHaveLength(2);

      // This query must complete without hanging
      const count = await repo.count();
      expect(count).toBe(5);
    }, 5_000);

    // ─── Resource cleanup: error mid-stream then subsequent query ──────────────
    test("error thrown inside stream for-await does not leak connection", async () => {
      const repo = getHandle().repository(TckSimpleUser);
      await repo.insert({ name: "ErrStream", age: 1 });

      let caught: Error | undefined;
      try {
        for await (const _entity of repo.stream()) {
          throw new Error("Stream error injection");
        }
      } catch (err) {
        caught = err as Error;
      }

      expect(caught).toBeDefined();
      expect(caught!.message).toBe("Stream error injection");

      // Verify handle is still usable
      const count = await repo.count();
      expect(count).toBeGreaterThan(0);
    }, 5_000);
  });
};
