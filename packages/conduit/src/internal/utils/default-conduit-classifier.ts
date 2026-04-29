import type { ErrorClassification } from "@lindorm/breaker";
import { LindormError, ServerError } from "@lindorm/errors";

const UNRECOVERABLE_STATUS = new Set([501, 505, 506, 510, 511]);

export const defaultConduitClassifier = (error: Error): ErrorClassification => {
  if (!(error instanceof LindormError)) return "ignorable";
  if (UNRECOVERABLE_STATUS.has(error.status)) return "permanent";
  if (error instanceof ServerError) return "transient";
  return "ignorable"; // client errors don't trip the breaker
};
