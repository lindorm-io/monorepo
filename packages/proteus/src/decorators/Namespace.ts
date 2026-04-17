import { stageNamespace } from "../internal/entity/metadata/stage-metadata";

/**
 * Place the entity in a specific namespace (schema/database).
 *
 * - `@Namespace("tenant")` — set namespace to "tenant"
 */
export const Namespace =
  (namespace: string) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageNamespace(context.metadata, namespace);
  };
