import type { ScopedName } from "../../../types/types.js";
import { buildScanPattern } from "./build-scan-pattern.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../entity/utils/get-entity-name.js", () => ({
  getEntityName: vi.fn(),
}));

import { getEntityName } from "../../../entity/utils/get-entity-name.js";

const mockGetEntityName = getEntityName as MockedFunction<typeof getEntityName>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

class TestEntity {
  id!: string;
}

const makeScopedName = (overrides: Partial<ScopedName> = {}): ScopedName => ({
  namespace: null,
  name: "test_entity",
  type: "entity",
  parts: ["entity", "test_entity"],
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildScanPattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should build pattern without namespace", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());
    expect(buildScanPattern(TestEntity, null)).toMatchSnapshot();
  });

  test("should build pattern with namespace", () => {
    mockGetEntityName.mockReturnValue(
      makeScopedName({
        namespace: "myapp",
        parts: ["myapp", "entity", "test_entity"],
      }),
    );
    expect(buildScanPattern(TestEntity, "myapp")).toMatchSnapshot();
  });
});
