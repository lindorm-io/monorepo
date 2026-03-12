import { MemoryCursor } from "./MemoryCursor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Item {
  id: number;
  name: string;
}

const makeItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `item-${i + 1}` }));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MemoryCursor", () => {
  describe("next()", () => {
    test("returns items in order", async () => {
      const items = makeItems(3);
      const cursor = new MemoryCursor(items);

      const results = [await cursor.next(), await cursor.next(), await cursor.next()];

      expect(results).toMatchSnapshot();
    });

    test("returns null when exhausted", async () => {
      const cursor = new MemoryCursor(makeItems(1));

      await cursor.next();
      const result = await cursor.next();

      expect(result).toBeNull();
    });

    test("returns null immediately for empty cursor", async () => {
      const cursor = new MemoryCursor<Item>([]);
      const result = await cursor.next();

      expect(result).toBeNull();
    });

    test("throws ProteusError after close()", async () => {
      const cursor = new MemoryCursor(makeItems(3));
      await cursor.close();

      await expect(cursor.next()).rejects.toThrow("Cursor is closed");
    });
  });

  describe("nextBatch()", () => {
    test("returns a batch of the given size", async () => {
      const cursor = new MemoryCursor(makeItems(5));
      const batch = await cursor.nextBatch(3);

      expect(batch).toMatchSnapshot();
    });

    test("returns remaining items when fewer than batch size remain", async () => {
      const cursor = new MemoryCursor(makeItems(2));
      const batch = await cursor.nextBatch(10);

      expect(batch).toMatchSnapshot();
    });

    test("advances position across calls", async () => {
      const cursor = new MemoryCursor(makeItems(6));
      const first = await cursor.nextBatch(2);
      const second = await cursor.nextBatch(2);
      const third = await cursor.nextBatch(2);

      expect({ first, second, third }).toMatchSnapshot();
    });

    test("returns empty array when exhausted", async () => {
      const cursor = new MemoryCursor(makeItems(2));
      await cursor.nextBatch(2);
      const result = await cursor.nextBatch(2);

      expect(result).toEqual([]);
    });

    test("returns empty array for empty cursor", async () => {
      const cursor = new MemoryCursor<Item>([]);
      const result = await cursor.nextBatch(5);

      expect(result).toEqual([]);
    });

    test("uses default batch size of 10", async () => {
      const cursor = new MemoryCursor(makeItems(15));
      const batch = await cursor.nextBatch();

      expect(batch).toHaveLength(10);
    });

    test("throws ProteusError after close()", async () => {
      const cursor = new MemoryCursor(makeItems(5));
      await cursor.close();

      await expect(cursor.nextBatch(5)).rejects.toThrow("Cursor is closed");
    });
  });

  describe("close()", () => {
    test("resolves without error", async () => {
      const cursor = new MemoryCursor(makeItems(3));
      await expect(cursor.close()).resolves.toBeUndefined();
    });

    test("can be called multiple times without error", async () => {
      const cursor = new MemoryCursor(makeItems(3));
      await cursor.close();
      await expect(cursor.close()).resolves.toBeUndefined();
    });
  });

  describe("async iterator", () => {
    test("iterates over all items in order", async () => {
      const items = makeItems(4);
      const cursor = new MemoryCursor(items);

      const results: Item[] = [];
      for await (const item of cursor) {
        results.push(item);
      }

      expect(results).toMatchSnapshot();
    });

    test("empty cursor produces no iterations", async () => {
      const cursor = new MemoryCursor<Item>([]);

      const results: Item[] = [];
      for await (const item of cursor) {
        results.push(item);
      }

      expect(results).toEqual([]);
    });

    test("breaking out of for-await calls return() and closes the cursor", async () => {
      const items = makeItems(5);
      const cursor = new MemoryCursor(items);

      const results: Item[] = [];
      for await (const item of cursor) {
        results.push(item);
        break;
      }

      // After break, cursor should be closed — next should throw
      await expect(cursor.next()).rejects.toThrow("Cursor is closed");
      expect(results).toHaveLength(1);
    });

    test("iterator is self-referential (Symbol.asyncIterator returns itself)", () => {
      const cursor = new MemoryCursor(makeItems(2));
      const iter = cursor[Symbol.asyncIterator]();
      expect(iter[Symbol.asyncIterator]()).toBe(iter);
    });

    test("iterator done: true when exhausted", async () => {
      const cursor = new MemoryCursor(makeItems(1));
      const iter = cursor[Symbol.asyncIterator]();

      const first = await iter.next();
      expect(first.done).toBe(false);

      const second = await iter.next();
      expect(second.done).toBe(true);
      expect(second.value).toBeUndefined();
    });
  });
});
