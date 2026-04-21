import {
  stagePrimaryKey,
  stageVersionKey,
} from "../internal/entity/metadata/stage-metadata.js";

/**
 * Mark one or more fields as the version key for temporal/versioned tables.
 *
 * Version key fields are included in the composite primary key alongside
 * the entity's regular primary key, enabling multiple versions of the same
 * logical entity to coexist in the version history table.
 *
 * - `@VersionKey()` — field-level: mark a single field
 * - `@VersionKey(["versionId"])` — class-level: define version key fields
 */
export function VersionKey(): (
  target: undefined,
  context: ClassFieldDecoratorContext,
) => void;
export function VersionKey<T extends abstract new (...args: any[]) => any>(
  fields: Array<keyof InstanceType<T>>,
): (target: T, context: ClassDecoratorContext<T>) => void;
export function VersionKey(fields?: any): any {
  return (_target: any, context: DecoratorContext) => {
    if (context.kind === "field") {
      const key = String(context.name);
      stagePrimaryKey(context.metadata, { key });
      stageVersionKey(context.metadata, { key });
    } else if (context.kind === "class") {
      for (const key of fields!) {
        stagePrimaryKey(context.metadata, { key: String(key) });
        stageVersionKey(context.metadata, { key: String(key) });
      }
    }
  };
}
