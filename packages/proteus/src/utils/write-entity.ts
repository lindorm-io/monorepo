import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { Logger } from "@lindorm/logger";
import { EntityMetadataError } from "../internal/entity/errors/EntityMetadataError.js";
import { generateEntitySource, PROTEUS_ENTITY_NAME_PATTERN } from "./generate-entity.js";

export type WriteEntityOptions = {
  name: string;
  directory: string;
  dryRun?: boolean;
};

export const writeEntity = async (options: WriteEntityOptions): Promise<void> => {
  const { name, directory, dryRun } = options;

  if (!PROTEUS_ENTITY_NAME_PATTERN.test(name)) {
    throw new EntityMetadataError(`Invalid entity name: "${name}" — must be PascalCase`, {
      code: "invalid_entity_name",
      title: "Invalid Entity Name",
      details: "An entity name must be PascalCase.",
      data: { name },
    });
  }

  const resolvedDirectory = resolve(process.cwd(), directory);
  const filename = `${name}.ts`;
  const filepath = join(resolvedDirectory, filename);
  const content = generateEntitySource({ name });

  if (dryRun) {
    Logger.std.log(`\nDry run — would create:\n`);
    Logger.std.log(`  ${filepath}\n`);
    Logger.std.log(content);
    return;
  }

  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");

  Logger.std.info(`Created entity: ${filename}`);
  Logger.std.log(`  Location: ${filepath}`);
};
