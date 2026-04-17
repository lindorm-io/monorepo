import { stagePrimaryKey } from "../internal/entity/metadata/stage-metadata";

/**
 * Mark one or more fields as the primary key.
 *
 * - `@PrimaryKey()` — field-level: mark a single field as (part of) the primary key
 * - `@PrimaryKey(["id", "tenantId"])` — class-level: define a composite primary key
 */
export function PrimaryKey(): (
  target: undefined,
  context: ClassFieldDecoratorContext,
) => void;
export function PrimaryKey<T extends abstract new (...args: any[]) => any>(
  fields: Array<keyof InstanceType<T>>,
): (target: T, context: ClassDecoratorContext<T>) => void;
export function PrimaryKey(fields?: any): any {
  return (_target: any, context: DecoratorContext) => {
    if (context.kind === "field") {
      stagePrimaryKey(context.metadata, { key: String(context.name) });
    } else if (context.kind === "class") {
      for (const key of fields!) {
        stagePrimaryKey(context.metadata, { key: String(key) });
      }
    }
  };
}
