import { writeMessage } from "../../../utils/write-message";

type GenerateMessageOptions = {
  directory?: string;
  dryRun?: boolean;
};

export const generateMessage = async (
  name: string | undefined,
  options: GenerateMessageOptions,
): Promise<void> => {
  if (!name) {
    const { input } = await import("@inquirer/prompts");

    name = await input({
      message: "Message name (PascalCase):",
      validate: (v) => (/^[A-Z][a-zA-Z0-9]*$/.test(v) ? true : "Must be PascalCase"),
    });
  }

  await writeMessage({
    name,
    directory: options.directory ?? "./src/iris/messages",
    dryRun: options.dryRun,
  });
};
