import { ClassLike, Constructor } from "@lindorm/types";
import {
  ErrorHandlerContext,
  ErrorHandlerFileAggregate,
  HandlerIdentifierMultipleContexts,
} from "../types";

export interface IErrorHandler<E extends Error = Error, D extends ClassLike = ClassLike> {
  error: Constructor<E>;
  aggregate?: ErrorHandlerFileAggregate;
  handler(ctx: ErrorHandlerContext<E, D>): Promise<void>;
}

export interface IHermesErrorHandler<E = Error, D extends ClassLike = ClassLike> {
  errorName: string;
  aggregate: HandlerIdentifierMultipleContexts;
  handler(ctx: ErrorHandlerContext<E, D>): Promise<void>;
}
