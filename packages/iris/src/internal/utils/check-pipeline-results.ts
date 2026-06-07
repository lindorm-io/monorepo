import { IrisTransportError } from "../../errors/IrisTransportError.js";

export const checkPipelineResults = (
  results: Array<[Error | null, unknown]> | null,
): void => {
  if (!results) {
    throw new IrisTransportError("Redis pipeline returned null results", {
      code: "pipeline_null_results",
    });
  }

  for (const [err] of results) {
    if (err) throw err;
  }
};
