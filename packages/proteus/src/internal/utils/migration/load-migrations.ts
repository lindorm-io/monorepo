import { existsSync, mkdirSync } from "fs";
import { isObjectLike } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import { Scanner } from "@lindorm/scanner";
import { ProteusError } from "../../../errors/index.js";
import type { MigrationInterfaceShape, LoadedMigrationShape } from "./resolve-pending.js";

const scanner = new Scanner({
  deniedFilenames: [/^index$/],
  deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
});

const isMigrationInterface = (value: unknown): value is MigrationInterfaceShape =>
  isObjectLike(value) &&
  typeof (value as MigrationInterfaceShape).id === "string" &&
  typeof (value as MigrationInterfaceShape).ts === "string" &&
  typeof (value as MigrationInterfaceShape).up === "function" &&
  typeof (value as MigrationInterfaceShape).down === "function";

export const loadMigrations = async (
  directory: string,
  logger: ILogger,
): Promise<Array<LoadedMigrationShape>> => {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  const data = scanner.scan(directory);

  if (!data.isDirectory) {
    throw new ProteusError("Migration path must be a directory", {
      debug: { directory },
    });
  }

  const files = data.children.filter(
    (c) => c.isFile && (c.extension === "ts" || c.extension === "js"),
  );
  // Sort by filename to ensure deterministic ordering (timestamp prefix)
  files.sort((a, b) => a.fullName.localeCompare(b.fullName));

  const migrations: Array<LoadedMigrationShape> = [];
  const seenIds = new Map<string, string>();

  for (const file of files) {
    // Derive filename stem: "20260220090000-init.js" -> "20260220090000-init"
    const stem = file.fullName.slice(0, -(file.extension!.length + 1));
    let module: Record<string, unknown>;
    try {
      module = await scanner.import<Record<string, unknown>>(file.fullPath);
    } catch {
      logger.warn("Failed to import migration file — skipping", { file: file.fullName });
      continue;
    }
    if (!module || typeof module !== "object") continue;
    const exports = Object.values(module);
    let found = false;

    for (const exported of exports) {
      // Migration classes need instantiation, plain objects can be used directly
      if (typeof exported === "function" && exported.prototype) {
        const instance = new (exported as new () => unknown)();
        if (isMigrationInterface(instance)) {
          const existing = seenIds.get(instance.id);
          if (existing) {
            throw new ProteusError("Duplicate migration ID", {
              debug: { id: instance.id, file: file.fullName, duplicateOf: existing },
            });
          }
          seenIds.set(instance.id, file.fullName);
          migrations.push({ migration: instance, name: stem });
          found = true;
          continue;
        }
      }

      if (isMigrationInterface(exported)) {
        const existing = seenIds.get(exported.id);
        if (existing) {
          throw new ProteusError("Duplicate migration ID", {
            debug: { id: exported.id, file: file.fullName, duplicateOf: existing },
          });
        }
        seenIds.set(exported.id, file.fullName);
        migrations.push({ migration: exported, name: stem });
        found = true;
        continue;
      }
    }

    if (!found && exports.length > 0) {
      logger.warn("Migration file skipped — no exports matched MigrationInterface", {
        file: file.fullName,
        hint: "requires id, ts, up, down",
      });
    }
  }

  return migrations;
};
