import { writeEntity } from "../../../utils/write-entity";

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

  await writeEntity({
    name,
    directory: options.directory ?? "./src/proteus/entities",
    dryRun: options.dryRun,
  });
};
