import { IrisMetadataError } from "../errors/IrisMetadataError";
import { stagePriority } from "#internal/message/metadata/stage-metadata";

export const Priority =
  (priority: number) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    if (!Number.isInteger(priority) || priority < 0 || priority > 10) {
      throw new IrisMetadataError("@Priority value must be an integer between 0 and 10");
    }
    stagePriority(context.metadata, priority);
  };
