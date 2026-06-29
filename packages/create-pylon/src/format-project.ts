import { readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { readdirSync } from "fs";
import prettier from "prettier";

const FORMATTABLE = /\.(ts|tsx|mts|cts|mjs|cjs|js|jsx|json|ya?ml|md)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "data"]);

const collectFiles = (dir: string, acc: Array<string>): Array<string> => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      collectFiles(full, acc);
    } else if (FORMATTABLE.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

/**
 * Format every generated source file with prettier so the scaffold output is
 * prettier-stable out of the box. The generated project ships no prettier
 * config, so prettier's defaults apply; a consumer with a custom config can
 * re-run their own formatter, but a fresh scaffold no longer trips
 * `prettier --check`.
 */
export const formatProject = async (projectDir: string): Promise<void> => {
  const files = collectFiles(projectDir, []);

  for (const file of files) {
    const info = await prettier.getFileInfo(file);
    if (info.ignored || !info.inferredParser) continue;

    const source = readFileSync(file, "utf-8");
    const config = await prettier.resolveConfig(file);
    const formatted = await prettier.format(source, { ...config, filepath: file });

    if (formatted !== source) {
      writeFileSync(file, formatted, "utf-8");
    }
  }
};
