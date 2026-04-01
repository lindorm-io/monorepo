import type { Constructor } from "@lindorm/types";
import type { StagedMetadata } from "./types";

export const getHermesMetadata = (target: Constructor): StagedMetadata => {
  const meta = (target as any)[Symbol.metadata];

  if (!meta) {
    return {};
  }

  return meta as StagedMetadata;
};
