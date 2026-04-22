import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type NpmInfo = { name: string; version: string };

const scopeToDirname = (scope: string): string => {
  const resolved = scope.startsWith("file://") ? fileURLToPath(scope) : scope;
  return dirname(resolved);
};

const findPackageJson = (startDir: string): string | null => {
  let current = startDir;
  while (true) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

const readPackage = (path: string): NpmInfo | null => {
  try {
    const pkg = JSON.parse(readFileSync(path, "utf-8")) as {
      name?: unknown;
      version?: unknown;
    };
    return {
      name: typeof pkg.name === "string" ? pkg.name : "",
      version: typeof pkg.version === "string" ? pkg.version : "",
    };
  } catch {
    return null;
  }
};

/**
 * Resolves the running process's npm identity.
 *
 * Resolution order:
 *   1. If `scope` is given (typically `import.meta.url` from the call
 *      site), walk up from its directory and read the nearest
 *      `package.json`. This is deterministic regardless of cwd, works
 *      under bare `node dist/index.js`, Docker CMDs, systemd units,
 *      and inside test runners.
 *   2. Fall back to `npm_package_name` / `npm_package_version` env
 *      vars (populated automatically by `npm run ...`).
 *   3. Empty strings when neither source resolves.
 *
 * Deliberately does NOT walk up from `process.cwd()` — cwd is a
 * user-controlled variable that doesn't always correspond to the
 * running package's root, so it's easy to accidentally pick up a
 * monorepo root, a test runner's package.json, or nothing at all.
 */
export const loadNpmInfo = (scope?: string): NpmInfo => {
  if (scope) {
    const startDir = scopeToDirname(scope);
    const pkgPath = findPackageJson(startDir);
    if (pkgPath) {
      const pkg = readPackage(pkgPath);
      if (pkg) return pkg;
    }
  }

  return {
    name: process.env.npm_package_name || "",
    version: process.env.npm_package_version || "",
  };
};
