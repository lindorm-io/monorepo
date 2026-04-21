import { extractNameData, stageDto } from "../internal/metadata/index.js";

type TimeoutOptions = {
  name?: string;
  version?: number;
};

export const Timeout =
  (nameOrOptions?: string | TimeoutOptions) =>
  (target: Function, context: ClassDecoratorContext): void => {
    const opts =
      typeof nameOrOptions === "string" ? { name: nameOrOptions } : (nameOrOptions ?? {});

    const { name: defaultName, version: defaultVersion } = extractNameData(target.name);

    stageDto(context.metadata, {
      kind: "timeout",
      name: opts.name ?? defaultName,
      version: opts.version ?? defaultVersion,
    });
  };
