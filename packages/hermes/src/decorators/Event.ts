import { extractNameData, stageDto } from "../internal/metadata";

type EventOptions = {
  name?: string;
  version?: number;
};

export const Event =
  (nameOrOptions?: string | EventOptions) =>
  (target: Function, context: ClassDecoratorContext): void => {
    const opts =
      typeof nameOrOptions === "string" ? { name: nameOrOptions } : (nameOrOptions ?? {});

    const { name: defaultName, version: defaultVersion } = extractNameData(target.name);

    stageDto(context.metadata, {
      kind: "event",
      name: opts.name ?? defaultName,
      version: opts.version ?? defaultVersion,
    });
  };
