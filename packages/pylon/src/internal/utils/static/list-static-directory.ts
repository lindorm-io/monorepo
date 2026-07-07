import { readdir, stat } from "fs/promises";
import { join } from "path";

export type StaticDirectoryEntry = {
  name: string;
  type: "file" | "directory";
  size: number;
  lastModified: Date;
};

// Directory listing payload. Dot-entries are excluded; each entry is stat'd
// (following symlinks) and any entry that fails to stat is silently skipped.
// Sorted by name for a stable response.
export const listStaticDirectory = async (
  directory: string,
): Promise<Array<StaticDirectoryEntry>> => {
  const dirents = await readdir(directory, { withFileTypes: true });
  const entries: Array<StaticDirectoryEntry> = [];

  for (const dirent of dirents) {
    if (dirent.name.startsWith(".")) continue;

    try {
      const stats = await stat(join(directory, dirent.name));

      entries.push({
        name: dirent.name,
        type: stats.isDirectory() ? "directory" : "file",
        size: stats.size,
        lastModified: new Date(stats.mtime),
      });
    } catch {
      continue;
    }
  }

  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return entries;
};
