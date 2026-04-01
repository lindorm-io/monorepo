import type { ILogger } from "@lindorm/logger";
import type { AggregateIdentifier } from "./aggregate-identifier";

export type SagaIdCtx<E> = {
  event: E;
  aggregate: AggregateIdentifier;
  logger: ILogger;
};
