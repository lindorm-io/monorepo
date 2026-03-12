import { formatStatusTable } from "./format-status-table";

describe("formatStatusTable", () => {
  it("should format empty list", () => {
    expect(formatStatusTable([], [], "./migrations")).toMatchSnapshot();
  });

  it("should format single applied migration", () => {
    expect(
      formatStatusTable(
        [{ name: "20260220090000-init", status: "applied" }],
        [],
        "./migrations",
      ),
    ).toMatchSnapshot();
  });

  it("should format mixed statuses", () => {
    expect(
      formatStatusTable(
        [
          { name: "20260220090000-init", status: "applied" },
          { name: "20260221100000-add-users", status: "applied" },
          { name: "20260222120000-add-orders", status: "pending" },
        ],
        [],
        "./migrations",
      ),
    ).toMatchSnapshot();
  });

  it("should format with checksum mismatch", () => {
    expect(
      formatStatusTable(
        [
          { name: "20260220090000-init", status: "applied" },
          { name: "20260221100000-add-users", status: "checksum_mismatch" },
          { name: "20260222120000-add-orders", status: "pending" },
        ],
        [],
        "./migrations",
      ),
    ).toMatchSnapshot();
  });

  it("should pad name column to longest name", () => {
    const output = formatStatusTable(
      [
        { name: "short", status: "applied" },
        { name: "very-long-migration-name-here", status: "pending" },
      ],
      [],
      "./migrations",
    );
    expect(output).toContain("short                          applied");
    expect(output).toContain("very-long-migration-name-here  pending");
  });
});
