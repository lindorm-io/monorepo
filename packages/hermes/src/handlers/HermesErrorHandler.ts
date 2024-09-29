import { snakeArray, snakeCase } from "@lindorm/case";
import { isArray } from "@lindorm/is";
import { ClassLike } from "@lindorm/types";
import { IHermesErrorHandler } from "../interfaces";
import {
  ErrorHandlerContext,
  ErrorHandlerOptions,
  HandlerIdentifierMultipleContexts,
} from "../types";

export class HermesErrorHandler<E = Error, D extends ClassLike = ClassLike>
  implements IHermesErrorHandler<E, D>
{
  public readonly errorName: string;
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly handler: (ctx: ErrorHandlerContext<E, D>) => Promise<void>;

  public constructor(options: ErrorHandlerOptions<E, D>) {
    this.aggregate = {
      name: snakeCase(options.aggregate.name),
      context: isArray(options.aggregate.context)
        ? snakeArray(options.aggregate.context)
        : snakeCase(options.aggregate.context),
    };
    this.errorName = options.errorName;
    this.handler = options.handler;
  }
}
