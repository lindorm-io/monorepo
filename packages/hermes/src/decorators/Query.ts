import { extractNameData, stageDto } from "../internal/metadata";

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
