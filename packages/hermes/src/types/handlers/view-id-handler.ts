import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import { NameData } from "../../utils/private";
import { HandlerIdentifier } from "../identifiers";

export type ViewIdCtx<E extends ClassLike> = {
  aggregate: HandlerIdentifier;
  event: E;
  logger: ILogger;
  meta: Dict;
  view: HandlerIdentifier;
};

export type ViewIdHandlerOptions<E extends ClassLike> = {
  aggregate: HandlerIdentifier;
  event: NameData;
  key: string;
  view: HandlerIdentifier;
  handler(ctx: ViewIdCtx<E>): string;
};
