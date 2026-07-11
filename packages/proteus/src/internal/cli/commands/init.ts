import {
  LINDORM_CONFIG_DEFAULTS,
  loadLindormConfig,
  resolveTarget,
} from "@lindorm/scaffold";
import { PROTEUS_ALL_DRIVERS } from "../../../utils/generate-source.js";
import { writeSource } from "../../../utils/write-source.js";

type InitOptions = {
  driver?: string;
  directory?: string;
  dryRun?: boolean;
};

export const init = async (options: InitOptions): Promise<void> => {
  let driver = options.driver;

  if (!driver) {
    const { select } = await import("@inquirer/prompts");

    driver = await select({
      message: "Select database driver:",
      choices: PROTEUS_ALL_DRIVERS.map((d) => ({ name: d, value: d })),
    });
  }

  const config = await loadLindormConfig();
  const directory = resolveTarget({
    arg: options.directory,
    config: config?.db?.sourceDir,
    default: LINDORM_CONFIG_DEFAULTS.db.sourceDir,
  });

  await writeSource({
    driver,
    directory,
    dryRun: options.dryRun,
  });
};
