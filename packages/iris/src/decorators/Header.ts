import { stageHeader } from "#internal/message/metadata/stage-metadata";

export const Header =
  (headerName?: string) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageHeader(context.metadata, {
      key: String(context.name),
      headerName: headerName ?? String(context.name),
    });
  };
