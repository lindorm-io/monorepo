import { extractNameData, stageDto } from "../internal/metadata/index.js";

type CommandOptions = {
  name?: string;
  version?: number;
};

export const Command =
  (nameOrOptions?: string | CommandOptions) =>
  (target: Function, context: ClassDecoratorContext): void => {
    const opts =
      typeof nameOrOptions === "string" ? { name: nameOrOptions } : (nameOrOptions ?? {});

    const { name: defaultName, version: defaultVersion } = extractNameData(target.name);

    stageDto(context.metadata, {
      kind: "command",
      name: opts.name ?? defaultName,
      version: opts.version ?? defaultVersion,
    });
  };
