import { createMockLogger } from "@lindorm/logger";
import {
  IRabbitMessageBus,
  IRabbitSource,
  IRabbitSubscription,
  RabbitSource,
} from "@lindorm/rabbit";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { IHermesMessage } from "../../interfaces";
import { HermesCommand, HermesEvent } from "../../messages";
import { HermesRabbitMessageBus } from "./HermesRabbitMessageBus";

describe("HermesRabbitMessageBus", () => {
  const logger = createMockLogger();

  let source: IRabbitSource;
  let messageBus: IRabbitMessageBus<IHermesMessage>;
  let commandSub: IRabbitSubscription<IHermesMessage>;
  let hermesEventSub: IRabbitSubscription<IHermesMessage>;

  beforeAll(async () => {
    source = new RabbitSource({
      logger,
      url: "amqp://localhost:5672",
    });

    await source.setup();

    messageBus = new HermesRabbitMessageBus(source, logger);

    commandSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "command-queue",
      topic: "context.aggregate.command_name",
    };

    hermesEventSub = {
      callback: jest.fn().mockImplementation(async () => {}),
      queue: "domain-event-queue",
      topic: "context.aggregate.hermes_event_name",
    };

    await messageBus.subscribe([commandSub, hermesEventSub]);
  }, 10000);

  afterAll(async () => {
    await source.disconnect();
  });

  test("should publish command", async () => {
    const hermesCommand = new HermesCommand({
      name: "command_name",
      data: { content: "command-data" },
      aggregate: {
        id: randomUUID(),
        name: "aggregate",
        context: "context",
      },
      meta: {
        origin: "test",
      },
    });

    await expect(messageBus.publish([hermesCommand])).resolves.toBeUndefined();

    await sleep(250);

    expect(commandSub.callback).toHaveBeenCalledTimes(1);
    expect(commandSub.callback).toHaveBeenCalledWith(hermesCommand);
  }, 15000);

  test("should publish event", async () => {
    const hermesCommand = new HermesCommand({
      name: "command_name",
      data: { content: "command-data" },
      aggregate: {
        id: randomUUID(),
        name: "aggregate",
        context: "context",
      },
      meta: {
        origin: "test",
      },
    });

    const hermesEvent = new HermesEvent(
      {
        name: "hermes_event_name",
        data: { content: "domain-event-data" },
        aggregate: {
          id: randomUUID(),
          name: "aggregate",
          context: "context",
        },
        meta: {
          origin: "test",
        },
      },
      hermesCommand,
    );

    await expect(messageBus.publish([hermesEvent])).resolves.toBeUndefined();

    await sleep(250);

    expect(hermesEventSub.callback).toHaveBeenCalledTimes(1);
    expect(hermesEventSub.callback).toHaveBeenCalledWith(hermesEvent);
  }, 15000);
});
