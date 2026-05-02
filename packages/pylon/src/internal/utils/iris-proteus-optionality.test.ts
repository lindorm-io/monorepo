import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, join, resolve as resolvePath } from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_ROOT = resolvePath(__dirname, "../../../dist");

const STATIC_IMPORT_RE =
  /^\s*(?:import|export)(?:\s+[^"';]+\s+from)?\s*["']([^"']+)["']/gm;

const collectStaticImports = (content: string): Array<string> => {
  const imports: Array<string> = [];
  let match: RegExpExecArray | null;
  STATIC_IMPORT_RE.lastIndex = 0;
  while ((match = STATIC_IMPORT_RE.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
};

const resolveRelative = (fromFile: string, spec: string): string | null => {
  if (!spec.startsWith(".")) return null;
  const fromDir = dirname(fromFile);
  const candidate = resolvePath(fromDir, spec);
  if (existsSync(candidate)) return candidate;
  return null;
};

const walkStaticGraph = async (entry: string): Promise<Set<string>> => {
  const visited = new Set<string>();
  const externals = new Set<string>();
  const queue: Array<string> = [entry];

  while (queue.length) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    let content: string;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }

    for (const spec of collectStaticImports(content)) {
      if (spec.startsWith(".")) {
        const resolved = resolveRelative(file, spec);
        if (resolved) queue.push(resolved);
        continue;
      }
      externals.add(spec);
    }
  }

  return externals;
};

describe("iris/proteus optionality (static graph)", () => {
  test("dist root entry exists", () => {
    expect(existsSync(join(DIST_ROOT, "index.js"))).toBe(true);
  });

  test("dist/index.js does not statically import @lindorm/iris", async () => {
    const content = await readFile(join(DIST_ROOT, "index.js"), "utf8");
    expect(content).not.toMatch(/from\s+["']@lindorm\/iris["']/);
    expect(content).not.toMatch(/import\s*\(\s*["']@lindorm\/iris["']\s*\)/);
  });

  test("dist/index.js does not statically import @lindorm/proteus", async () => {
    const content = await readFile(join(DIST_ROOT, "index.js"), "utf8");
    expect(content).not.toMatch(/from\s+["']@lindorm\/proteus["']/);
    expect(content).not.toMatch(/import\s*\(\s*["']@lindorm\/proteus["']\s*\)/);
  });

  test("static module graph from dist/index.js excludes iris/proteus", async () => {
    const externals = await walkStaticGraph(join(DIST_ROOT, "index.js"));

    expect(externals.has("@lindorm/iris")).toBe(false);
    expect(externals.has("@lindorm/proteus")).toBe(false);

    for (const spec of externals) {
      expect(spec.startsWith("@lindorm/iris")).toBe(false);
      expect(spec.startsWith("@lindorm/proteus")).toBe(false);
    }
  });
});
