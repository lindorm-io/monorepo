import { formatApplyResult, formatRollbackResult } from "./format-migration-result.js";
import { describe, expect, it } from "vitest";

describe("formatApplyResult", () => {
  it("should format single applied migration", () => {
    expect(
      formatApplyResult(
        [{ name: "20260220090000-init", durationMs: 42 }],
        0,
        "./migrations",
      ),
    ).toMatchSnapshot();
  });

  it("should format multiple applied with skipped", () => {
    expect(
      formatApplyResult(
        [
          { name: "20260220090000-init", durationMs: 42 },
          { name: "20260221100000-add-users", durationMs: 18 },
        ],
        1,
        "./migrations",
      ),
    ).toMatchSnapshot();
  });
});

describe("formatRollbackResult", () => {
  it("should format single rollback", () => {
    expect(
      formatRollbackResult(
        [{ name: "20260221100000-add-users", durationMs: 12 }],
        "./migrations",
      ),
    ).toMatchSnapshot();
  });

  it("should format multiple rollbacks", () => {
    expect(
      formatRollbackResult(
        [
          { name: "20260222120000-add-orders", durationMs: 8 },
          { name: "20260221100000-add-users", durationMs: 12 },
        ],
        "./migrations",
      ),
    ).toMatchSnapshot();
  });
});
