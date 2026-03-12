export type MigrationResultEntry = {
  name: string;
  durationMs: number;
};

export const formatApplyResult = (
  entries: Array<MigrationResultEntry>,
  skipped: number,
  directory: string,
): string => {
  const lines: Array<string> = [];

  lines.push(`Applying migrations from ${directory} ...`);

  for (const entry of entries) {
    lines.push(`  Applied: ${entry.name} (${entry.durationMs}ms)`);
  }

  lines.push("");
  lines.push(`${entries.length} migration(s) applied, ${skipped} skipped.`);

  return lines.join("\n");
};

export const formatRollbackResult = (
  entries: Array<MigrationResultEntry>,
  directory: string,
): string => {
  const lines: Array<string> = [];

  lines.push(`Rolling back from ${directory} ...`);

  for (const entry of entries) {
    lines.push(`  Rolled back: ${entry.name} (${entry.durationMs}ms)`);
  }

  lines.push("");
  lines.push(`${entries.length} migration(s) rolled back.`);

  return lines.join("\n");
};
