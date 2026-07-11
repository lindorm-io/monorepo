import {
  LINDORM_CONFIG_DEFAULTS,
  loadLindormConfig,
  resolveTarget,
} from "@lindorm/scaffold";
import { writeEntity } from "../../../utils/write-entity.js";

type GenerateEntityOptions = {
  directory?: string;
  dryRun?: boolean;
};

export const generateEntity = async (
  name: string | undefined,
  options: GenerateEntityOptions,
): Promise<void> => {
  if (!name) {
    const { input } = await import("@inquirer/prompts");

    name = await input({
      message: "Entity name (PascalCase):",
      validate: (v) => (/^[A-Z][a-zA-Z0-9]*$/.test(v) ? true : "Must be PascalCase"),
    });
  }

  const config = await loadLindormConfig();
  const directory = resolveTarget({
    arg: options.directory,
    config: config?.db?.entitiesDir,
    default: LINDORM_CONFIG_DEFAULTS.db.entitiesDir,
  });

  await writeEntity({
    name,
    directory,
    dryRun: options.dryRun,
  });
};
