import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField, MetaFieldDecorator } from "../types/metadata.js";
import type { StagedFieldModifier } from "../types/staged.js";

// Framework decorators whose write behaviour is fully managed by the update /
// upsert pipeline. An operation-scoped @ReadOnly on these is nonsensical.
const FRAMEWORK_DECORATORS = new Set<MetaFieldDecorator>([
  "Version",
  "CreateDate",
  "UpdateDate",
]);

/**
 * Reject an operation-scoped `@ReadOnly("update" | "upsert")` on conflict-managed /
 * framework columns (primary key, @VersionField, @CreateDateField, @UpdateDateField).
 *
 * These columns' behaviour on both update and upsert is owned by the pipeline, so
 * narrowing their read-only scope to a single operation is meaningless. A bare
 * `@ReadOnly()` (both operations) is still allowed — it merely restates the
 * immutability the framework already enforces.
 */
export const validateReadonlyOperations = <TDecorator extends MetaFieldDecorator>(
  targetName: string,
  fields: Array<MetaField<TDecorator>>,
  fieldModifiers: Array<StagedFieldModifier>,
  primaryKeys: Array<string>,
): void => {
  for (const modifier of fieldModifiers) {
    if (modifier.decorator !== "ReadOnly") continue;
    // Only an explicit operation argument narrows the scope to a single op.
    // A bare @ReadOnly() stages both operations and is always permitted.
    if (!modifier.readonly || modifier.readonly.length !== 1) continue;

    const field = fields.find((f) => f.key === modifier.key);
    if (!field) continue; // missing @Field is reported by mergeFieldModifiers

    const isPrimaryKey = primaryKeys.includes(field.key);
    const isFramework = FRAMEWORK_DECORATORS.has(field.decorator);
    if (!isPrimaryKey && !isFramework) continue;

    const operation = modifier.readonly[0];
    const columnKind = isPrimaryKey ? "primary key" : `@${field.decorator}Field`;

    throw new EntityMetadataError(
      `@ReadOnly("${operation}") cannot be applied to ${columnKind} "${field.key}"`,
      {
        code: "invalid_readonly_operation",
        title: "Invalid ReadOnly Operation",
        details: `Property "${field.key}" on "${targetName}" is a framework-managed ${columnKind} whose write behaviour on update and upsert is controlled by proteus — an operation-scoped @ReadOnly("${operation}") is nonsensical here. Remove it, or use a bare @ReadOnly() to restate full immutability.`,
        debug: { target: targetName, property: field.key, operation },
      },
    );
  }
};
