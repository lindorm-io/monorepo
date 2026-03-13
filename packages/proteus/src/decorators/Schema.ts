import { z } from "zod/v4";
import { IEntity } from "../interfaces";
import { stageSchema } from "#internal/entity/metadata/stage-metadata";

/**
 * Attach a Zod schema to an entity for runtime validation.
 *
 * The schema is evaluated during `repository.validate()` and before every
 * insert/update. Validation errors are surfaced as ProteusErrors.
 */
export const Schema =
  (schema: z.ZodObject<IEntity>) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageSchema(context.metadata, schema);
  };
