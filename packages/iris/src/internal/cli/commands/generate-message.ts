import {
  LINDORM_CONFIG_DEFAULTS,
  loadLindormConfig,
  resolveTarget,
} from "@lindorm/scaffold";
import { writeMessage } from "../../../utils/write-message.js";

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

  const config = await loadLindormConfig();
  const directory = resolveTarget({
    arg: options.directory,
    config: config?.iris?.messagesDir,
    default: LINDORM_CONFIG_DEFAULTS.iris.messagesDir,
  });

  await writeMessage({
    name,
    directory,
    dryRun: options.dryRun,
  });
};
