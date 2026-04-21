import type { ScopedName } from "../../../types/types.js";
import { buildIncrementKey } from "./build-increment-key.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../entity/utils/get-entity-name.js", () => ({
  getEntityName: vi.fn(),
}));

import { getEntityName } from "../../../entity/utils/get-entity-name.js";

const mockGetEntityName = getEntityName as MockedFunction<typeof getEntityName>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

class TestEntity {
  id!: number;
}

const makeScopedName = (overrides: Partial<ScopedName> = {}): ScopedName => ({
  namespace: null,
  name: "test_entity",
  type: "entity",
  parts: ["entity", "test_entity"],
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildIncrementKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should build increment key without namespace", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());
    expect(buildIncrementKey(TestEntity, "id", null)).toMatchSnapshot();
  });

  test("should build increment key with namespace", () => {
    mockGetEntityName.mockReturnValue(
      makeScopedName({
        namespace: "myapp",
        parts: ["myapp", "entity", "test_entity"],
      }),
    );
    expect(buildIncrementKey(TestEntity, "id", "myapp")).toMatchSnapshot();
  });

  test("should build increment key for different field names", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());
    expect(buildIncrementKey(TestEntity, "sequence", null)).toMatchSnapshot();
  });
});
