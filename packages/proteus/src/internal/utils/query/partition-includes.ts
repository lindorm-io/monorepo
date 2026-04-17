import type { IncludeSpec } from "../../types/query";

export type PartitionedIncludes = {
  joinIncludes: Array<IncludeSpec>;
  queryIncludes: Array<IncludeSpec>;
};

export const partitionIncludes = (includes: Array<IncludeSpec>): PartitionedIncludes => {
  const joinIncludes: Array<IncludeSpec> = [];
  const queryIncludes: Array<IncludeSpec> = [];

  for (const inc of includes) {
    if (inc.strategy === "query") {
      queryIncludes.push(inc);
    } else {
      joinIncludes.push(inc);
    }
  }

  return { joinIncludes, queryIncludes };
};
