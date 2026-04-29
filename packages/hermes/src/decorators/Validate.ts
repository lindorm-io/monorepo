import type { z } from "zod";
import { stageValidation } from "../internal/metadata/index.js";

export const Validate =
  (schema: z.ZodType) =>
  (_target: Function, context: ClassMethodDecoratorContext): void => {
    stageValidation(context.metadata, {
      methodName: String(context.name),
      schema,
    });
  };
