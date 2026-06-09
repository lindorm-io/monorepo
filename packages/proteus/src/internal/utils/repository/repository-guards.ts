import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";

export const guardDeleteDateField = (metadata: EntityMetadata, method: string): void => {
  const field = metadata.fields.find((f) => f.decorator === "DeleteDate");
  if (!field) {
    throw new ProteusRepositoryError(
      `${method}() requires @DeleteDateField on "${metadata.entity.name}"`,
      {
        code: "missing_delete_date_field",
        title: "Missing Delete Date Field",
        details: "Add a @DeleteDateField to the entity to enable soft-delete operations.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const guardExpiryDateField = (metadata: EntityMetadata, method: string): void => {
  const field = metadata.fields.find((f) => f.decorator === "ExpiryDate");
  if (!field) {
    throw new ProteusRepositoryError(
      `${method}() requires @ExpiryDateField on "${metadata.entity.name}"`,
      {
        code: "missing_expiry_date_field",
        title: "Missing Expiry Date Field",
        details:
          "Add an @ExpiryDateField to the entity to enable expiry-based operations.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const guardVersionFields = (metadata: EntityMetadata, method: string): void => {
  const startDate = metadata.fields.find((f) => f.decorator === "VersionStartDate");
  const endDate = metadata.fields.find((f) => f.decorator === "VersionEndDate");
  if (!startDate || !endDate) {
    throw new ProteusRepositoryError(
      `${method}() requires @VersionStartDateField and @VersionEndDateField on "${metadata.entity.name}"`,
      {
        code: "missing_version_fields",
        title: "Missing Version Fields",
        details:
          "Add both @VersionStartDateField and @VersionEndDateField to the entity to enable versioned operations.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const guardUpsertBlocked = (metadata: EntityMetadata): void => {
  const hasVersionStartDate = metadata.fields.some(
    (f) => f.decorator === "VersionStartDate",
  );
  const hasVersionEndDate = metadata.fields.some((f) => f.decorator === "VersionEndDate");

  if (hasVersionStartDate || hasVersionEndDate) {
    throw new ProteusRepositoryError(
      `upsert() is not supported on versioned entity "${metadata.entity.name}"`,
      {
        code: "upsert_not_supported",
        title: "Upsert Not Supported",
        details:
          "Upsert is not available on versioned entities; use insert or update instead.",
        debug: { entityName: metadata.entity.name },
      },
    );
  }

  const hasIncrementPk = metadata.generated.some(
    (g) => g.strategy === "increment" && metadata.primaryKeys.includes(g.key),
  );

  if (hasIncrementPk) {
    throw new ProteusRepositoryError(
      `upsert() is not supported on entity "${metadata.entity.name}" with auto-increment primary key`,
      {
        code: "upsert_not_supported",
        title: "Upsert Not Supported",
        details:
          "Upsert is not available on entities with an auto-increment primary key; use insert or update instead.",
        debug: { entityName: metadata.entity.name },
      },
    );
  }
};

export const guardAppendOnly = (metadata: EntityMetadata, method: string): void => {
  if (metadata.appendOnly) {
    throw new ProteusRepositoryError(
      `Cannot ${method} an append-only entity "${metadata.entity.name}"`,
      {
        code: "append_only_violation",
        title: "Append Only Violation",
        details:
          "Append-only entities permit inserts only; update and delete operations are not allowed.",
        debug: { entityName: metadata.entity.name, method },
      },
    );
  }
};

export const validateRelationNames = (
  metadata: EntityMetadata,
  names: Array<string>,
): void => {
  const validNames = new Set(metadata.relations.map((r) => r.key));
  for (const name of names) {
    if (!validNames.has(name)) {
      throw new ProteusRepositoryError(
        `Unknown relation "${name}" on "${metadata.entity.name}". Available: [${[...validNames].join(", ")}]`,
        {
          code: "unknown_relation",
          title: "Unknown Relation",
          details: "The requested relation is not declared on this entity.",
          debug: { entityName: metadata.entity.name, relation: name },
        },
      );
    }
  }
};
