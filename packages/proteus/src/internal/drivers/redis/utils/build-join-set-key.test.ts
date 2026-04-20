import type { ScopedName } from "../../../types/types";
import { buildJoinSetKey, buildReverseJoinSetKey } from "./build-join-set-key";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("../../../entity/utils/get-join-name", () => ({
  getJoinName: vi.fn(),
}));

import { getJoinName } from "../../../entity/utils/get-join-name";

const mockGetJoinName = getJoinName as MockedFunction<typeof getJoinName>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeScopedName = (overrides: Partial<ScopedName> = {}): ScopedName => ({
  namespace: null,
  name: "post_x_tag",
  type: "join",
  parts: ["join", "post_x_tag"],
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("buildJoinSetKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should build forward key without namespace", () => {
    mockGetJoinName.mockReturnValue(makeScopedName());
    expect(buildJoinSetKey("post_x_tag", "post_id", "p1", null)).toMatchSnapshot();
  });

  test("should build forward key with namespace", () => {
    mockGetJoinName.mockReturnValue(
      makeScopedName({
        namespace: "myapp",
        parts: ["myapp", "join", "post_x_tag"],
      }),
    );
    expect(buildJoinSetKey("post_x_tag", "post_id", "p1", "myapp")).toMatchSnapshot();
  });

  test("should encode values containing colons", () => {
    mockGetJoinName.mockReturnValue(makeScopedName());
    expect(buildJoinSetKey("post_x_tag", "post_id", "val:colon", null)).toMatchSnapshot();
  });
});

describe("buildReverseJoinSetKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should build reverse key without namespace", () => {
    mockGetJoinName.mockReturnValue(makeScopedName());
    expect(buildReverseJoinSetKey("post_x_tag", "tag_id", "t1", null)).toMatchSnapshot();
  });

  test("should build reverse key with namespace", () => {
    mockGetJoinName.mockReturnValue(
      makeScopedName({
        namespace: "myapp",
        parts: ["myapp", "join", "post_x_tag"],
      }),
    );
    expect(
      buildReverseJoinSetKey("post_x_tag", "tag_id", "t1", "myapp"),
    ).toMatchSnapshot();
  });
});
