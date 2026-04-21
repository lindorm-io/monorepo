import { writeVersionSnapshot } from "./write-version-snapshot.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createMockDb = () => {
  const insertOne = vi.fn().mockResolvedValue({ acknowledged: true });
  const collection = vi.fn().mockReturnValue({ insertOne });
  return { db: { collection } as any, collection, insertOne };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("writeVersionSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should call insertOne on the shadow collection", async () => {
    const { db, collection, insertOne } = createMockDb();

    await writeVersionSnapshot(db, "users", { _id: "abc", name: "John" }, 1);

    expect(collection).toHaveBeenCalledWith("users_versions");
    expect(insertOne).toHaveBeenCalledTimes(1);
  });

  test("should add __version and __versionedAt to document", async () => {
    const { db, insertOne } = createMockDb();

    await writeVersionSnapshot(db, "users", { _id: "abc", name: "John" }, 3);

    const insertedDoc = insertOne.mock.calls[0][0];
    expect(insertedDoc.__version).toBe(3);
    expect(insertedDoc.__versionedAt).toEqual(new Date("2024-06-15T12:00:00.000Z"));
    expect(insertedDoc).toMatchSnapshot();
  });

  test("should replace _id with __entityId", async () => {
    const { db, insertOne } = createMockDb();

    await writeVersionSnapshot(db, "orders", { _id: "order-1", total: 100 }, 1);

    const insertedDoc = insertOne.mock.calls[0][0];
    expect(insertedDoc.__entityId).toBe("order-1");
    expect(insertedDoc._id).toBeUndefined();
    expect(insertedDoc).toMatchSnapshot();
  });

  test("should pass session option when session is provided", async () => {
    const { db, insertOne } = createMockDb();
    const mockSession = { id: "session-1" } as any;

    await writeVersionSnapshot(db, "users", { _id: "abc", name: "John" }, 1, mockSession);

    expect(insertOne).toHaveBeenCalledWith(expect.any(Object), { session: mockSession });
  });

  test("should not pass session option when session is undefined", async () => {
    const { db, insertOne } = createMockDb();

    await writeVersionSnapshot(db, "users", { _id: "abc", name: "John" }, 1);

    expect(insertOne).toHaveBeenCalledWith(expect.any(Object), undefined);
  });

  test("should preserve all non-_id fields in snapshot", async () => {
    const { db, insertOne } = createMockDb();

    const doc = {
      _id: "abc",
      name: "John",
      age: 30,
      tags: ["a", "b"],
      nested: { x: 1 },
    };

    await writeVersionSnapshot(db, "users", doc, 5);

    const insertedDoc = insertOne.mock.calls[0][0];
    expect(insertedDoc.name).toBe("John");
    expect(insertedDoc.age).toBe(30);
    expect(insertedDoc.tags).toEqual(["a", "b"]);
    expect(insertedDoc.nested).toEqual({ x: 1 });
    expect(insertedDoc).toMatchSnapshot();
  });
});
