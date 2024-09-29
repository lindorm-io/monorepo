import { ILogger } from "@lindorm/logger";
import { ClassLike } from "@lindorm/types";
import { IHermesMessage } from "../../interfaces";
import {
  AggregateIdentifier,
  HandlerIdentifierMultipleContexts,
  SagaIdentifier,
  ViewIdentifier,
} from "../identifiers";

export type ErrorDispatchOptions = {
  aggregate?: Partial<AggregateIdentifier>;
  delay?: number;
  mandatory?: boolean;
};

export type ErrorHandlerContext<E = Error, D extends ClassLike = ClassLike> = {
  error: E;
  message: IHermesMessage;
  saga?: SagaIdentifier;
  view?: ViewIdentifier;
  logger: ILogger;
  dispatch(command: D, options?: ErrorDispatchOptions): Promise<void>;
};

export type ErrorHandlerFileAggregate = {
  context?: Array<string> | string;
};

export type ErrorHandlerOptions<E = Error, D extends ClassLike = ClassLike> = {
  errorName: string;
  aggregate: HandlerIdentifierMultipleContexts;
  handler(ctx: ErrorHandlerContext<E, D>): Promise<void>;
};
