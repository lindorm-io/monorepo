import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField, MetaGenerated } from "../types/metadata.js";

export const inferGeneratedTypes = (
  targetName: string,
  generated: Array<MetaGenerated>,
  fields: Array<MetaField>,
): void => {
  const seen = new Set<string>();
  for (const generate of generated) {
    if (seen.has(generate.key)) {
      throw new EntityMetadataError("Duplicate @Generated for field", {
        code: "duplicate_generated_field",
        title: "Duplicate Generated Field",
        details: `Property "${generate.key}" on "${targetName}" has more than one @Generated decorator — keep only a single @Generated for each property.`,
        debug: { target: targetName, field: generate.key },
      });
    }
    seen.add(generate.key);
  }

  for (const generate of generated) {
    const field = fields.find((f) => f.key === generate.key);
    if (!field) {
      throw new EntityMetadataError("Generated field not found", {
        code: "missing_generated_field",
        title: "Missing Generated Field",
        details: `@Generated on "${generate.key}" targets a property with no matching @Field on "${targetName}" — add a @Field decorator for that property.`,
        debug: { target: targetName, field: generate.key },
      });
    }
    // Function generators are client-side; a column type cannot be inferred from
    // a function, so an explicit @Field type is required.
    if (generate.generator) {
      if (field.type === null) {
        throw new EntityMetadataError("Invalid @Generated strategy for field type", {
          code: "invalid_generated_strategy",
          title: "Invalid Generated Strategy",
          details: `@Generated(() => ...) on "${field.key}" requires an explicit @Field type — a column type cannot be inferred from a function generator.`,
          debug: { target: targetName, field: field.key },
        });
      }
      continue;
    }

    if (field.type === null) {
      switch (generate.strategy) {
        case "identity":
        case "increment":
        case "integer":
          field.type = "integer";
          break;
        case "float":
          field.type = "float";
          break;
        case "uuid":
          field.type = "uuid";
          break;
        case "lindorm_id":
          field.type = "varchar";
          field.max = 64;
          break;
        case "string":
          field.type = "string";
          break;
        case "date":
          field.type = "timestamp";
          break;
      }
    } else if (field.type) {
      switch (generate.strategy) {
        case "date":
          if (field.type !== "date" && field.type !== "timestamp") {
            throw new EntityMetadataError("Invalid @Generated strategy for field type", {
              code: "invalid_generated_strategy",
              title: "Invalid Generated Strategy",
              details: `@Generated("date") on "${field.key}" requires a date or timestamp field type, but "${field.type}" was declared — change the @Field type or the @Generated strategy.`,
              debug: {
                target: targetName,
                field: field.key,
                strategy: "date",
                type: field.type,
              },
            });
          }
          break;
        case "float":
          if (
            field.type !== "float" &&
            field.type !== "real" &&
            field.type !== "decimal"
          ) {
            throw new EntityMetadataError("Invalid @Generated strategy for field type", {
              code: "invalid_generated_strategy",
              title: "Invalid Generated Strategy",
              details: `@Generated("float") on "${field.key}" requires a float, real, or decimal field type, but "${field.type}" was declared — change the @Field type or the @Generated strategy.`,
              debug: {
                target: targetName,
                field: field.key,
                strategy: "float",
                type: field.type,
              },
            });
          }
          break;
        case "identity":
        case "increment":
        case "integer":
          if (
            field.type !== "integer" &&
            field.type !== "smallint" &&
            field.type !== "bigint"
          ) {
            throw new EntityMetadataError("Invalid @Generated strategy for field type", {
              code: "invalid_generated_strategy",
              title: "Invalid Generated Strategy",
              details: `@Generated("${generate.strategy}") on "${field.key}" requires an integer, smallint, or bigint field type, but "${field.type}" was declared — change the @Field type or the @Generated strategy.`,
              debug: {
                target: targetName,
                field: field.key,
                strategy: generate.strategy,
                type: field.type,
              },
            });
          }
          break;
        case "string":
          if (field.type !== "string" && field.type !== "text") {
            throw new EntityMetadataError("Invalid @Generated strategy for field type", {
              code: "invalid_generated_strategy",
              title: "Invalid Generated Strategy",
              details: `@Generated("string") on "${field.key}" requires a string or text field type, but "${field.type}" was declared — change the @Field type or the @Generated strategy.`,
              debug: {
                target: targetName,
                field: field.key,
                strategy: "string",
                type: field.type,
              },
            });
          }
          break;
        case "uuid":
          if (field.type !== "uuid") {
            throw new EntityMetadataError("Invalid @Generated strategy for field type", {
              code: "invalid_generated_strategy",
              title: "Invalid Generated Strategy",
              details: `@Generated("uuid") on "${field.key}" requires a uuid field type, but "${field.type}" was declared — change the @Field type or the @Generated strategy.`,
              debug: {
                target: targetName,
                field: field.key,
                strategy: "uuid",
                type: field.type,
              },
            });
          }
          break;
        case "lindorm_id":
          if (
            field.type !== "varchar" &&
            field.type !== "string" &&
            field.type !== "text"
          ) {
            throw new EntityMetadataError("Invalid @Generated strategy for field type", {
              code: "invalid_generated_strategy",
              title: "Invalid Generated Strategy",
              details: `@Generated("lindorm_id") on "${field.key}" requires a varchar, string, or text field type, but "${field.type}" was declared — change the @Field type or the @Generated strategy.`,
              debug: {
                target: targetName,
                field: field.key,
                strategy: "lindorm_id",
                type: field.type,
              },
            });
          }
          if (field.type === "varchar" && field.max === null) {
            field.max = 64;
          }
          break;
      }
    }
  }

  // Any field still without a type had no @Field type and no @Generated to infer
  // one (e.g. a bare `@PrimaryKeyField()`). Surface a clear metadata error instead
  // of letting a null column type leak into DDL/sync.
  for (const field of fields) {
    if (field.type === null) {
      throw new EntityMetadataError("Field has no resolvable type", {
        code: "missing_field_type",
        title: "Missing Field Type",
        details: `Property "${field.key}" on "${targetName}" has no column type — give it an explicit type (e.g. @Field("uuid") or @PrimaryKeyField("uuid")) or add a @Generated(...) so the type can be inferred.`,
        debug: { target: targetName, field: field.key },
      });
    }
  }
};
