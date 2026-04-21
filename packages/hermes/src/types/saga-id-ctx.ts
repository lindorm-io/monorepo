import type { ILogger } from "@lindorm/logger";
import type { AggregateIdentifier } from "./aggregate-identifier.js";

export type SagaIdCtx<E> = {
  event: E;
  aggregate: AggregateIdentifier;
  logger: ILogger;
};
