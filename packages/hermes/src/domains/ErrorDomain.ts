import { snakeCase } from "@lindorm/case";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { ClassLike } from "@lindorm/types";
import merge from "deepmerge";
import { z } from "zod";
import { HandlerNotRegisteredError } from "../errors";
import { HermesErrorHandler } from "../handlers";
import { IErrorDomain, IHermesErrorHandler, IHermesMessageBus } from "../interfaces";
import { HermesError } from "../messages";
import { HermesMessageSchema } from "../schemas";
import {
  ErrorDispatchOptions,
  ErrorDomainOptions,
  ErrorHandlerContext,
  HermesMessageOptions,
} from "../types";

export class ErrorDomain implements IErrorDomain {
  private readonly commandBus: IHermesMessageBus;
  private readonly errorBus: IHermesMessageBus;
  private readonly errorHandlers: Array<IHermesErrorHandler>;
  private readonly logger: ILogger;

  public constructor(options: ErrorDomainOptions) {
    this.logger = options.logger.child(["ErrorDomain"]);

    this.commandBus = options.commandBus;
    this.errorBus = options.errorBus;

    this.errorHandlers = [];
  }

  public async registerErrorHandler(errorHandler: IHermesErrorHandler): Promise<void> {
    this.logger.debug("Registering error handler", {
      errorName: errorHandler.errorName,
      aggregate: errorHandler.aggregate,
    });

    if (!(errorHandler instanceof HermesErrorHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "ErrorHandler",
          actual: typeof errorHandler,
        },
      });
    }

    const contexts = Array.isArray(errorHandler.aggregate.context)
      ? errorHandler.aggregate.context
      : [errorHandler.aggregate.context];

    for (const context of contexts) {
      const existingHandler = this.errorHandlers.some(
        (x) =>
          x.errorName === errorHandler.errorName &&
          x.aggregate.name === errorHandler.aggregate.name &&
          x.aggregate.context === context,
      );

      if (existingHandler) {
        throw new LindormError("Error handler has already been registered", {
          debug: {
            errorName: errorHandler.errorName,
            aggregate: {
              name: errorHandler.aggregate.name,
              context: errorHandler.aggregate.context,
            },
          },
        });
      }

      this.errorHandlers.push(
        new HermesErrorHandler({
          errorName: errorHandler.errorName,
          aggregate: {
            name: errorHandler.aggregate.name,
            context,
          },
          handler: errorHandler.handler,
        }),
      );

      await this.errorBus.subscribe({
        callback: (message: HermesError) => this.handleError(message),
        queue: ErrorDomain.getQueue(context, errorHandler),
        topic: ErrorDomain.getTopic(context, errorHandler),
      });

      this.logger.verbose("Error handler registered", {
        errorName: errorHandler.errorName,
        aggregate: {
          name: errorHandler.aggregate.name,
          context,
        },
      });
    }
  }

  private async handleError(message: HermesError): Promise<void> {
    this.logger.debug("Handling error", { message });

    const errorHandler = this.errorHandlers.find(
      (x) =>
        x.errorName === message.name &&
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.context === message.aggregate.context,
    );

    if (!(errorHandler instanceof HermesErrorHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const ctx: ErrorHandlerContext = {
      error: message.data.error,
      message: message.data.message,
      saga: message.data.saga,
      view: message.data.view,
      logger: this.logger.child(["ErrorHandler"]),
      dispatch: this.dispatchCommand.bind(this, message),
    };

    try {
      await errorHandler.handler(ctx);

      this.logger.verbose("Handled error message", { message });
    } catch (err: any) {
      this.logger.error("Failed to handle error", err);
    }
  }

  private async dispatchCommand(
    causation: HermesError,
    command: ClassLike,
    options: ErrorDispatchOptions = {},
  ): Promise<void> {
    this.logger.debug("Dispatch", { causation, command, options });

    z.object({
      causation: HermesMessageSchema,
      command: z.record(z.any()),
      options: z
        .object({
          aggregate: z
            .object({
              id: z.string().optional(),
              name: z.string().optional(),
              context: z.string().optional(),
            })
            .optional(),
          delay: z.number().optional(),
          mandatory: z.boolean().optional(),
        })
        .optional(),
    }).parse({ causation, command, options });

    const { ...data } = command;

    await this.commandBus.publish(
      this.commandBus.create(
        merge<HermesMessageOptions, ErrorDispatchOptions>(
          {
            name: snakeCase(command.constructor.name),
            data,
            aggregate: causation.aggregate,
            correlationId: causation.correlationId,
            meta: causation.meta,
          },
          options,
        ),
      ),
    );
  }

  private static getQueue(context: string, errorHandler: IHermesErrorHandler): string {
    return `queue.error.${context}.${errorHandler.aggregate.name}.${errorHandler.errorName}`;
  }

  private static getTopic(context: string, errorHandler: IHermesErrorHandler): string {
    return `${context}.${errorHandler.aggregate.name}.${errorHandler.errorName}`;
  }
}
