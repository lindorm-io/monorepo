import { resolve } from "path";
import { randomUUID } from "crypto";
import { Logger } from "@lindorm/logger";
import { writeMigrationFile } from "../../utils/migration/write-migration-file";
import { formatTimestamp, sanitizeName, kebabToPascal } from "../utils/migration-naming";
import type { GlobalOptions } from "../with-source";
import { withSourceConfig } from "../with-source";

type CreateOptions = GlobalOptions & {
  name: string;
  directory?: string;
};

export const migrateCreate = async (options: CreateOptions): Promise<void> => {
  await withSourceConfig(options, async ({ source }) => {
    const directory = resolve(process.cwd(), options.directory ?? "./migrations");

    const now = new Date();
    const stamp = formatTimestamp(now);
    const slug = sanitizeName(options.name);

    if (!slug) {
      throw new Error("Migration name must contain at least one alphanumeric character");
    }

    const className = kebabToPascal(slug);
    const id = randomUUID();
    const ts = now.toISOString();
    const filename = `${stamp}-${slug}.ts`;
    const driverType = source.driverType;

    // TODO: use driver-specific runner type for non-SQL drivers
    const content = [
      `import type { MigrationInterface, SqlMigrationRunner } from "@lindorm/proteus";`,
      ``,
      `export class ${className} implements MigrationInterface {`,
      `  public readonly id = "${id}";`,
      `  public readonly ts = "${ts}";`,
      `  public readonly driver = "${driverType}";`,
      ``,
      `  public async up(runner: SqlMigrationRunner): Promise<void> {`,
      `    // TODO: implement`,
      `  }`,
      ``,
      `  public async down(runner: SqlMigrationRunner): Promise<void> {`,
      `    // TODO: implement`,
      `  }`,
      `}`,
      ``,
    ].join("\n");

    const filepath = await writeMigrationFile(directory, filename, content);

    Logger.std.info(`Created migration: ${filename}`);
    Logger.std.log(`  Location: ${filepath}`);
  });
};
