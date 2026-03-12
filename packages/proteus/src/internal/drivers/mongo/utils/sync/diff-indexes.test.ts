import type { DesiredMongoIndex, ExistingMongoIndex } from "./types";
import { diffIndexes } from "./diff-indexes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeExisting = (
  overrides: Partial<ExistingMongoIndex> = {},
): ExistingMongoIndex => ({
  collection: "users",
  name: "idx_name",
  keys: { name: 1 },
  unique: false,
  sparse: false,
  expireAfterSeconds: null,
  ...overrides,
});

const makeDesired = (overrides: Partial<DesiredMongoIndex> = {}): DesiredMongoIndex => ({
  collection: "users",
  name: "idx_name",
  keys: { name: 1 },
  unique: false,
  sparse: false,
  expireAfterSeconds: null,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("diffIndexes", () => {
  test("should return empty plan when no indexes exist and none desired", () => {
    expect(diffIndexes([], [], new Set(["users"]))).toMatchSnapshot();
  });

  test("should create new index when not in existing", () => {
    const desired = [makeDesired({ name: "idx_email", keys: { email: 1 } })];
    expect(diffIndexes([], desired, new Set(["users"]))).toMatchSnapshot();
  });

  test("should drop existing index when not in desired", () => {
    const existing = [makeExisting({ name: "idx_old", keys: { old: 1 } })];
    expect(diffIndexes(existing, [], new Set(["users"]))).toMatchSnapshot();
  });

  test("should keep index unchanged when it matches", () => {
    const existing = [makeExisting()];
    const desired = [makeDesired()];
    const plan = diffIndexes(existing, desired, new Set(["users"]));
    expect(plan).toMatchSnapshot();
  });

  test("should drop and recreate when keys differ", () => {
    const existing = [makeExisting({ name: "idx_a", keys: { name: 1 } })];
    const desired = [makeDesired({ name: "idx_a", keys: { name: -1 } })];
    expect(diffIndexes(existing, desired, new Set(["users"]))).toMatchSnapshot();
  });

  test("should drop and recreate when unique flag changes", () => {
    const existing = [makeExisting({ unique: false })];
    const desired = [makeDesired({ unique: true })];
    expect(diffIndexes(existing, desired, new Set(["users"]))).toMatchSnapshot();
  });

  test("should drop and recreate when sparse flag changes", () => {
    const existing = [makeExisting({ sparse: false })];
    const desired = [makeDesired({ sparse: true })];
    expect(diffIndexes(existing, desired, new Set(["users"]))).toMatchSnapshot();
  });

  test("should drop and recreate when TTL changes", () => {
    const existing = [makeExisting({ expireAfterSeconds: 3600 })];
    const desired = [makeDesired({ expireAfterSeconds: 7200 })];
    expect(diffIndexes(existing, desired, new Set(["users"]))).toMatchSnapshot();
  });

  test("should detect new collections to create", () => {
    const desired = [
      makeDesired({ collection: "orders", name: "idx_total", keys: { total: 1 } }),
    ];
    const plan = diffIndexes([], desired, new Set(["users"]));
    expect(plan.collectionsToCreate).toMatchSnapshot();
  });

  test("should not mark existing collection for creation", () => {
    const desired = [makeDesired()];
    const plan = diffIndexes([], desired, new Set(["users"]));
    expect(plan.collectionsToCreate).toEqual([]);
  });

  test("should handle multiple indexes across collections", () => {
    const existing = [
      makeExisting({ collection: "users", name: "idx_name" }),
      makeExisting({ collection: "orders", name: "idx_total", keys: { total: 1 } }),
    ];
    const desired = [
      makeDesired({ collection: "users", name: "idx_name" }),
      makeDesired({ collection: "orders", name: "idx_status", keys: { status: 1 } }),
      makeDesired({ collection: "products", name: "idx_sku", keys: { sku: 1 } }),
    ];
    expect(
      diffIndexes(existing, desired, new Set(["users", "orders"])),
    ).toMatchSnapshot();
  });
});
