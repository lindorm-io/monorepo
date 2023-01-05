import Joi from "joi";
import { Command, ErrorMessage } from "../message";
import { ErrorHandlerImplementation } from "../handler";
import { HandlerNotRegisteredError } from "../error";
import { Logger } from "@lindorm-io/core-logger";
import { IMessageBus } from "@lindorm-io/amqp";
import { JOI_MESSAGE } from "../schema";
import { LindormError } from "@lindorm-io/errors";
import { assertSchema, assertSnakeCase } from "../util";
import { find, isArray, merge, snakeCase, some } from "lodash";
import {
  AggregateIdentifier,
  DtoClass,
  ErrorDispatchOptions,
  ErrorHandlerContext,
  IErrorDomain,
  IErrorHandler,
} from "../types";

export class ErrorDomain implements IErrorDomain {
  private readonly errorHandlers: Array<IErrorHandler>;
  private readonly logger: Logger;
  private readonly messageBus: IMessageBus;

  public constructor(messageBus: IMessageBus, logger: Logger) {
    this.logger = logger.createChildLogger(["ErrorDomain"]);
    this.messageBus = messageBus;

    this.errorHandlers = [];
  }

  public async registerErrorHandler(errorHandler: IErrorHandler): Promise<void> {
    this.logger.debug("Registering error handler", {
      errorName: errorHandler.errorName,
      aggregate: errorHandler.aggregate,
    });

    if (!(errorHandler instanceof ErrorHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "ErrorHandler",
          actual: typeof errorHandler,
        },
      });
    }

    const contexts = isArray(errorHandler.aggregate.context)
      ? errorHandler.aggregate.context
      : [errorHandler.aggregate.context];

    for (const context of contexts) {
      const existingHandler = some(this.errorHandlers, {
        errorName: errorHandler.errorName,
        aggregate: {
          name: errorHandler.aggregate.name,
          context,
        },
      });

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

      assertSnakeCase(context);
      assertSnakeCase(errorHandler.aggregate.name);
      assertSnakeCase(errorHandler.errorName);

      this.errorHandlers.push(
        new ErrorHandlerImplementation({
          errorName: errorHandler.errorName,
          aggregate: {
            name: errorHandler.aggregate.name,
            context,
          },
          handler: errorHandler.handler,
        }),
      );

      await this.messageBus.subscribe({
        callback: (message: ErrorMessage) => this.handleError(message),
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

  private async handleError(message: ErrorMessage): Promise<void> {
    this.logger.debug("Handling error", { message });

    const errorHandler = find(this.errorHandlers, {
      errorName: message.name,
      aggregate: {
        name: message.aggregate.name,
        context: message.aggregate.context,
      },
    });

    if (!(errorHandler instanceof ErrorHandlerImplementation)) {
      throw new HandlerNotRegisteredError();
    }

    const ctx: ErrorHandlerContext = {
      error: message.data.error,
      message: message.data.message,
      saga: message.data.saga,
      view: message.data.view,
      logger: this.logger.createChildLogger(["ErrorHandler"]),
      dispatch: this.dispatchMessage.bind(this, message),
    };

    try {
      await errorHandler.handler(ctx);

      this.logger.verbose("Handled error message", { message });
    } catch (err) {
      this.logger.error("Failed to handle error", err);
    }
  }

  private async dispatchMessage(
    causation: ErrorMessage,
    command: DtoClass,
    options: ErrorDispatchOptions = {},
  ): Promise<void> {
    this.logger.debug("Dispatch", { causation, command, options });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          command: Joi.object().required(),
          options: Joi.object<ErrorDispatchOptions>()
            .keys({
              aggregate: Joi.object<AggregateIdentifier>()
                .keys({
                  id: Joi.string().guid().optional(),
                  name: Joi.string().optional(),
                  context: Joi.string().optional(),
                })
                .optional(),
              delay: Joi.number().optional(),
              mandatory: Joi.boolean().optional(),
            })
            .optional(),
        })
        .required()
        .validate({ causation, command, options }),
    );

    const { ...data } = command;

    await this.messageBus.publish(
      new Command(
        merge(
          {
            name: snakeCase(command.constructor.name),
            data,
            ...options,
          },
          {
            aggregate: causation.aggregate,
            correlationId: causation.correlationId,
            metadata: causation.metadata,
          },
        ),
      ),
    );
  }

  private static getQueue(context: string, errorHandler: IErrorHandler): string {
    return `queue.error.${context}.${errorHandler.aggregate.name}.${errorHandler.errorName}`;
  }

  private static getTopic(context: string, errorHandler: IErrorHandler): string {
    return `${context}.${errorHandler.aggregate.name}.${errorHandler.errorName}`;
  }
}
