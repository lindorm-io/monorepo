import type { SyncOperation, SyncSeverity } from "../../drivers/postgres/types/sync-plan";

const severityLabel = (severity: SyncSeverity): string => {
  switch (severity) {
    case "safe":
      return "safe".padEnd(12);
    case "warning":
      return "warning".padEnd(12);
    case "destructive":
      return "destructive".padEnd(12);
  }
};

export const previewOperations = (operations: Array<SyncOperation>): string => {
  const executable = operations.filter((op) => op.type !== "warn_only");
  const lines: Array<string> = [];

  lines.push(`Operations (${executable.length}):`);
  lines.push("");

  for (const op of executable) {
    lines.push(`  ${severityLabel(op.severity)} ${op.description}`);
  }

  lines.push("");

  const safe = executable.filter((o) => o.severity === "safe").length;
  const warning = executable.filter((o) => o.severity === "warning").length;
  const destructive = executable.filter((o) => o.severity === "destructive").length;

  lines.push(`  Summary: ${safe} safe, ${warning} warning, ${destructive} destructive`);

  return lines.join("\n");
};
