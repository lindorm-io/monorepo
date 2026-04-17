import type { EntityMetadata } from "../../../entity/types/metadata";
import type { ScopedName } from "../../../types/types";
import { buildEntityKey, buildEntityKeyFromRow } from "./build-entity-key";

// ─── Module Mocks ────────────────────────────────────────────────────────────

jest.mock("../../../entity/utils/get-entity-name", () => ({
  getEntityName: jest.fn(),
}));

import { getEntityName } from "../../../entity/utils/get-entity-name";

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

describe("buildEntityKey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should build key without namespace", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());
    expect(buildEntityKey(TestEntity, ["pk-1"], null)).toMatchSnapshot();
  });

  test("should build key with namespace", () => {
    mockGetEntityName.mockReturnValue(
      makeScopedName({
        namespace: "myapp",
        parts: ["myapp", "entity", "test_entity"],
      }),
    );
    expect(buildEntityKey(TestEntity, ["pk-1"], "myapp")).toMatchSnapshot();
  });

  test("should build key with composite PK", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());
    expect(buildEntityKey(TestEntity, ["pk-1", "pk-2"], null)).toMatchSnapshot();
  });

  test("should encode PK values containing colons", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());
    expect(buildEntityKey(TestEntity, ["val:with:colons"], null)).toMatchSnapshot();
  });

  test("should handle numeric PK values", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());
    expect(buildEntityKey(TestEntity, [42], null)).toMatchSnapshot();
  });
});

describe("buildEntityKeyFromRow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should extract PK from row in metadata order", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());

    const metadata = {
      primaryKeys: ["id"],
    } as unknown as EntityMetadata;

    const row = { id: "abc-123", name: "test" };

    expect(buildEntityKeyFromRow(TestEntity, row, metadata, null)).toMatchSnapshot();
  });

  test("should handle composite PK from row", () => {
    mockGetEntityName.mockReturnValue(makeScopedName());

    const metadata = {
      primaryKeys: ["tenantId", "userId"],
    } as unknown as EntityMetadata;

    const row = { tenantId: "t1", userId: "u1", name: "test" };

    expect(buildEntityKeyFromRow(TestEntity, row, metadata, null)).toMatchSnapshot();
  });
});
