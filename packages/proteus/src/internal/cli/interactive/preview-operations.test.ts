import type { SyncOperation } from "../../drivers/postgres/types/sync-plan";
import { previewOperations } from "./preview-operations";

const makeOp = (overrides: Partial<SyncOperation> = {}): SyncOperation => ({
  type: "add_column",
  severity: "safe",
  schema: "public",
  table: "users",
  description: "add column name",
  sql: "ALTER TABLE ...",
  autocommit: false,
  ...overrides,
});

describe("previewOperations", () => {
  it("should produce the correct output for a mix of severities", () => {
    const ops = [
      makeOp({ severity: "safe", description: "add column id" }),
      makeOp({ severity: "warning", description: "alter column type" }),
      makeOp({ severity: "destructive", description: "drop column old_name" }),
    ];

    expect(previewOperations(ops)).toMatchSnapshot();
  });

  it("should show correct operation count in header", () => {
    const ops = [makeOp(), makeOp(), makeOp()];
    const result = previewOperations(ops);
    expect(result).toContain("Operations (3):");
  });

  it("should include summary line with counts by severity", () => {
    const ops = [
      makeOp({ severity: "safe" }),
      makeOp({ severity: "warning" }),
      makeOp({ severity: "warning" }),
      makeOp({ severity: "destructive" }),
    ];

    const result = previewOperations(ops);
    expect(result).toContain("Summary: 1 safe, 2 warning, 1 destructive");
  });

  it("should exclude warn_only operations from the listing", () => {
    const ops = [
      makeOp({ type: "warn_only", severity: "warning", description: "warn only msg" }),
      makeOp({ severity: "safe", description: "safe op" }),
    ];

    const result = previewOperations(ops);

    // count should be 1 (not 2)
    expect(result).toContain("Operations (1):");
    expect(result).not.toContain("warn only msg");
    expect(result).toContain("safe op");
  });

  it("should handle empty operations list", () => {
    const result = previewOperations([]);
    expect(result).toContain("Operations (0):");
    expect(result).toContain("Summary: 0 safe, 0 warning, 0 destructive");
  });

  it("should include each operation description in the output", () => {
    const ops = [
      makeOp({ description: "create table accounts" }),
      makeOp({ description: "add index on email" }),
    ];

    const result = previewOperations(ops);
    expect(result).toContain("create table accounts");
    expect(result).toContain("add index on email");
  });

  it("should produce all-safe output as snapshot", () => {
    const ops = [
      makeOp({ severity: "safe", description: "add column created_at" }),
      makeOp({ severity: "safe", description: "add index on user_id" }),
    ];

    expect(previewOperations(ops)).toMatchSnapshot();
  });

  it("should produce all-destructive output as snapshot", () => {
    const ops = [
      makeOp({ severity: "destructive", description: "drop column legacy_id" }),
    ];

    expect(previewOperations(ops)).toMatchSnapshot();
  });
});
