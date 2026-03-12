import type { ScopedName } from "#internal/types/types";
import { buildScanPattern } from "./build-scan-pattern";

// ─── Module Mocks ────────────────────────────────────────────────────────────

jest.mock("#internal/entity/utils/get-entity-name", () => ({
  getEntityName: jest.fn(),
}));

import { getEntityName } from "#internal/entity/utils/get-entity-name";

const mockGetEntityName = getEntityName as jest.MockedFunction<typeof getEntityName>;

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
    jest.clearAllMocks();
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
