import { ErrorDomain } from "./ErrorDomain";
import { IMessageBus } from "@lindorm-io/amqp";
import { AggregateIdentifier, IErrorDomain } from "../types";
import { createMockLogger } from "@lindorm-io/core-logger";
import { MessageBus } from "../infrastructure";
import { ErrorHandlerImplementation } from "../handler";
import { TEST_AGGREGATE_COMMAND_HANDLER } from "../fixtures/aggregate-command-handler.fixture";
import { Command, ErrorMessage } from "../message";
import { snakeCase } from "lodash";
import { AggregateAlreadyCreatedError } from "../error";
import { randomUUID } from "crypto";

describe("ErrorDomain", () => {
  const logger = createMockLogger();

  let domain: IErrorDomain;
  let messageBus: IMessageBus;

  beforeEach(() => {
    messageBus = new MessageBus({ type: "memory" }, logger);
    domain = new ErrorDomain(messageBus, logger);
  });

  test("should register error handler", async () => {
    const handler = new ErrorHandlerImplementation({
      errorName: "aggregate_already_created_error",
      aggregate: { name: "test_aggregate", context: "default" },
      handler: async () => {},
    });

    await expect(domain.registerErrorHandler(handler)).resolves.not.toThrow();
  });

  test("should handle error message and dispatch command", async () => {
    const ctxSpy = jest.fn();
    const commandSpy = jest.fn();

    class TestCommand {
      public constructor(public readonly test: string) {}
    }

    const aggregate: AggregateIdentifier = {
      id: randomUUID(),
      name: "test_aggregate",
      context: "default",
    };

    const handler = new ErrorHandlerImplementation({
      errorName: "aggregate_already_created_error",
      aggregate: { name: aggregate.name, context: aggregate.context },
      handler: async (ctx) => {
        ctxSpy(ctx);
        await ctx.dispatch(new TestCommand("test string"));
      },
    });

    await domain.registerErrorHandler(handler);

    await messageBus.subscribe({
      callback: async (message) => {
        commandSpy(message);
      },
      queue: "test.queue.for.command",
      topic: "default.test_aggregate.test_command",
    });

    await expect(
      messageBus.publish(
        new ErrorMessage({
          name: snakeCase(new AggregateAlreadyCreatedError().name),
          aggregate,
          data: {
            error: new AggregateAlreadyCreatedError(),
            message: new Command({ name: "causation", aggregate }),
          },
          metadata: {},
          mandatory: true,
        }),
      ),
    ).resolves.not.toThrow();

    expect(ctxSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(AggregateAlreadyCreatedError),
      }),
    );

    expect(commandSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test_command",
        data: { test: "test string" },
      }),
    );
  });

  test("should throw on invalid handler type", async () => {
    await expect(
      // @ts-ignore
      domain.registerErrorHandler(TEST_AGGREGATE_COMMAND_HANDLER),
    ).rejects.toThrow();
  });

  test("should throw on existing error handler", async () => {
    const handler = new ErrorHandlerImplementation({
      errorName: "aggregate_already_created_error",
      aggregate: { name: "test_aggregate", context: "default" },
      handler: async () => {},
    });

    await expect(domain.registerErrorHandler(handler)).resolves.not.toThrow();
    await expect(domain.registerErrorHandler(handler)).rejects.toThrow();
  });
});
