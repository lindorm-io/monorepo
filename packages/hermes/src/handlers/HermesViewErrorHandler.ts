import { Constructor } from "@lindorm/types";
import { DomainError } from "../errors";
import { IViewErrorHandler } from "../interfaces";
import { HandlerIdentifier, ViewErrorCallback, ViewErrorHandlerOptions } from "../types";

export class HermesViewErrorHandler<C extends Constructor<DomainError>>
  implements IViewErrorHandler<C>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly error: string;
  public readonly key: string;
  public readonly view: HandlerIdentifier;
  public readonly handler: ViewErrorCallback<C>;

  public constructor(options: ViewErrorHandlerOptions<C>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.error = options.error;
    this.key = options.key;
    this.view = { name: options.view.name, context: options.view.context };
    this.handler = options.handler;
  }
}
