import type { ILogger } from "@lindorm/logger";
import type { EntityMetadata } from "../../entity/types/metadata";
import type { IncludeSpec } from "../../types/query";
import { findRelationByKey } from "./get-relation-metadata";

const MANY_RELATION_JOIN_THRESHOLD = 2;

export const warnCartesianIncludes = (
  joinIncludes: Array<IncludeSpec>,
  metadata: EntityMetadata,
  logger: ILogger,
): void => {
  const manyJoins = joinIncludes.filter((inc) => {
    const relation = findRelationByKey(metadata, inc.relation);
    return relation.type === "OneToMany" || relation.type === "ManyToMany";
  });

  if (manyJoins.length >= MANY_RELATION_JOIN_THRESHOLD) {
    logger.warn(
      `Query on "${metadata.entity.name}" joins ${manyJoins.length} *ToMany relations (${manyJoins.map((i) => i.relation).join(", ")}), which may cause cartesian explosion. Consider using strategy: "query" on some relations.`,
    );
  }
};
