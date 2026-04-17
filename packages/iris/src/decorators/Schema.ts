import type { z } from "zod";
import { stageFieldModifier } from "../internal/message/metadata/stage-metadata";

export const Schema =
  (schema: z.ZodType) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Schema",
      schema,
    });
  };
