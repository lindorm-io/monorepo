import { EntityMetadataError } from "../errors/EntityMetadataError";
import type { MetaField, MetaGenerated } from "../types/metadata";

export const inferGeneratedTypes = (
  targetName: string,
  generated: Array<MetaGenerated>,
  fields: Array<MetaField>,
): void => {
  for (const generate of generated) {
    const field = fields.find((f) => f.key === generate.key);
    if (!field) {
      throw new EntityMetadataError("Generated field not found", {
        debug: { target: targetName, field: generate.key },
      });
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
              debug: {
                target: targetName,
                field: field.key,
                strategy: "uuid",
                type: field.type,
              },
            });
          }
          break;
      }
    }
  }
};
