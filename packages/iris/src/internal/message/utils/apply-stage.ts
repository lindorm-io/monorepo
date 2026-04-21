import type { PipelineStage } from "../../types/pipeline-stage.js";

export const applyStage = (
  stage: Exclude<PipelineStage, { type: "batch" }>,
  items: Array<any>,
): Array<any> => {
  switch (stage.type) {
    case "filter":
      return items.filter(stage.predicate);

    case "map":
      return items.map(stage.transform);

    case "flatMap":
      return items.flatMap(stage.transform);
  }
};
