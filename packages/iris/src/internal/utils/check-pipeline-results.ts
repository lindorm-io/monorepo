import { IrisTransportError } from "../../errors/IrisTransportError.js";

export const checkPipelineResults = (
  results: Array<[Error | null, unknown]> | null,
): void => {
  if (!results) {
    throw new IrisTransportError("Redis pipeline returned null results", {
      code: "pipeline_null_results",
      title: "Pipeline Null Results",
      details:
        "The Redis pipeline returned null instead of a results array, indicating the pipeline did not execute. Retry the operation.",
    });
  }

  for (const [err] of results) {
    if (err) throw err;
  }
};
