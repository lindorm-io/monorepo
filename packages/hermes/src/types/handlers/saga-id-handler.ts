import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { NameData } from "../../utils/private";
import { HandlerIdentifier } from "../identifiers";

export type SagaIdCtx<E extends ClassLike> = {
  aggregate: HandlerIdentifier;
  event: E;
  logger: ILogger;
  meta: Dict;
  saga: HandlerIdentifier;
};

export type SagaIdHandlerOptions<E extends ClassLike> = {
  aggregate: HandlerIdentifier;
  event: NameData;
  key: string;
  saga: HandlerIdentifier;
  handler(ctx: SagaIdCtx<E>): string;
};
