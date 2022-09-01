import { AggregateIdentifier, SagaIdentifier, ViewIdentifier } from "../model";
import { Constructor, DtoClass } from "../generic";
import { HandlerIdentifierMultipleContexts } from "./handler";
import { ILogger } from "@lindorm-io/winston";
import { IMessage } from "../message";

export interface ErrorDispatchOptions {
  aggregate?: Partial<AggregateIdentifier>;
  delay?: number;
  mandatory?: boolean;
}

export interface ErrorHandlerContext<TError = Error, TDispatch extends DtoClass = DtoClass> {
  error: TError;
  message: IMessage;
  saga?: SagaIdentifier;
  view?: ViewIdentifier;
  logger: ILogger;
  dispatch(command: TDispatch, options?: ErrorDispatchOptions): void;
}

export interface ErrorHandlerFileAggregate {
  context?: Array<string> | string;
}

export interface ErrorHandler<TError, TDispatch extends DtoClass = DtoClass> {
  error: Constructor<TError>;
  aggregate?: ErrorHandlerFileAggregate;
  handler(ctx: ErrorHandlerContext<TError, TDispatch>): Promise<void>;
}

export interface ErrorHandlerOptions<TError = Error, TDispatch extends DtoClass = DtoClass> {
  errorName: string;
  aggregate: HandlerIdentifierMultipleContexts;
  handler(ctx: ErrorHandlerContext<TError, TDispatch>): Promise<void>;
}

export interface IErrorHandler<TError = Error, TDispatch extends DtoClass = DtoClass> {
  errorName: string;
  aggregate: HandlerIdentifierMultipleContexts;
  handler(ctx: ErrorHandlerContext<TError, TDispatch>): Promise<void>;
}
