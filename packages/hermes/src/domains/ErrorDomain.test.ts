import { snakeCase } from "@lindorm/case";
import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_COMMAND_HANDLER } from "../__fixtures__/aggregate-command-handler";
import { AggregateAlreadyCreatedError } from "../errors";
import { HermesErrorHandler } from "../handlers";
import { IErrorDomain, IHermesMessageBus } from "../interfaces";
import { HermesCommand, HermesError } from "../messages";
import { AggregateIdentifier } from "../types";
import { ErrorDomain } from "./ErrorDomain";

describe("ErrorDomain", () => {
  const logger = createMockLogger();

  let domain: IErrorDomain;
  let messageBus: IHermesMessageBus;

  beforeEach(() => {
    messageBus = createMockRabbitMessageBus(HermesError);
    domain = new ErrorDomain({ messageBus, logger });
  });

  test("should register error handler", async () => {
    const handler = new HermesErrorHandler({
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

    const handler = new HermesErrorHandler({
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
        new HermesError({
          name: snakeCase(new AggregateAlreadyCreatedError().name),
          aggregate,
          data: {
            error: new AggregateAlreadyCreatedError(),
            message: new HermesCommand({ name: "causation", aggregate }),
          },
          meta: {},
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
    await expect(() =>
      // @ts-expect-error
      domain.registerErrorHandler(TEST_AGGREGATE_COMMAND_HANDLER),
    ).rejects.toThrow();
  });

  test("should throw on existing error handler", async () => {
    const handler = new HermesErrorHandler({
      errorName: "aggregate_already_created_error",
      aggregate: { name: "test_aggregate", context: "default" },
      handler: async () => {},
    });

    await expect(domain.registerErrorHandler(handler)).resolves.not.toThrow();
    await expect(domain.registerErrorHandler(handler)).rejects.toThrow();
  });
});
