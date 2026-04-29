import { extractNameData, stageDto } from "../internal/metadata/index.js";

export const Query =
  (name?: string) =>
  (target: Function, context: ClassDecoratorContext): void => {
    const { name: defaultName } = extractNameData(target.name);

    stageDto(context.metadata, {
      kind: "query",
      name: name ?? defaultName,
      version: 1,
    });
  };
