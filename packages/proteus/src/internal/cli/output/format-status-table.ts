export type StatusEntry = {
  name: string;
  status: "pending" | "applied" | "checksum_mismatch";
};

export type GhostEntry = {
  name: string;
  id: string;
};

const statusLabel = (status: StatusEntry["status"]): string => {
  switch (status) {
    case "applied":
      return "applied";
    case "pending":
      return "pending";
    case "checksum_mismatch":
      return "checksum mismatch";
  }
};

export const formatStatusTable = (
  entries: Array<StatusEntry>,
  ghosts: Array<GhostEntry>,
  directory: string,
): string => {
  const lines: Array<string> = [];

  lines.push(`Migration Status (${directory}):`);
  lines.push("");

  if (entries.length === 0 && ghosts.length === 0) {
    lines.push("  No migrations found.");
    return lines.join("\n");
  }

  if (entries.length > 0) {
    const maxName = Math.max(...entries.map((e) => e.name.length), 4);

    lines.push(`  ${"Name".padEnd(maxName)}  Status`);
    lines.push(`  ${"─".repeat(maxName)}  ${"─".repeat(20)}`);

    for (const entry of entries) {
      lines.push(`  ${entry.name.padEnd(maxName)}  ${statusLabel(entry.status)}`);
    }

    lines.push("");
  }

  const applied = entries.filter((e) => e.status === "applied").length;
  const pending = entries.filter((e) => e.status === "pending").length;
  const mismatches = entries.filter((e) => e.status === "checksum_mismatch").length;

  lines.push(
    `${applied} applied, ${pending} pending, ${mismatches} checksum mismatches.`,
  );

  if (ghosts.length > 0) {
    lines.push("");
    lines.push(
      `WARNING: ${ghosts.length} ghost migration(s) — applied to DB but source file missing:`,
    );

    for (const ghost of ghosts) {
      lines.push(`  - ${ghost.name} (${ghost.id})`);
    }
  }

  return lines.join("\n");
};
