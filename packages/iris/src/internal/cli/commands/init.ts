import { IRIS_ALL_DRIVERS } from "../../../utils/generate-source.js";
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
      message: "Select messaging driver:",
      choices: IRIS_ALL_DRIVERS.map((d) => ({ name: d, value: d })),
    });
  }

  await writeSource({
    driver,
    directory: options.directory ?? "./src/iris",
    dryRun: options.dryRun,
  });
};
