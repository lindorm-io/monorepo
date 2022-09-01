import {
  DtoClass,
  ErrorHandlerContext,
  ErrorHandlerOptions,
  HandlerIdentifierMultipleContexts,
  IErrorHandler,
} from "../types";

export class ErrorHandlerImplementation<TError = Error, TDispatch extends DtoClass = DtoClass>
  implements IErrorHandler<TError, TDispatch>
{
  public readonly errorName: string;
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly handler: (ctx: ErrorHandlerContext<TError, TDispatch>) => Promise<void>;

  public constructor(options: ErrorHandlerOptions<TError, TDispatch>) {
    this.errorName = options.errorName;
    this.aggregate = options.aggregate;
    this.handler = options.handler;
  }
}
