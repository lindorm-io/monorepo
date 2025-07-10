import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { ChecksumError } from "../errors";
import { IChecksumDomain, IHermesMessageBus } from "../interfaces";
import { HermesError, HermesEvent } from "../messages";
import { AggregateIdentifier } from "../types";
import { ChecksumDomain } from "./ChecksumDomain";

describe("ChecksumDomain", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let domain: IChecksumDomain;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  let store: any;

  beforeEach(async () => {
    aggregate = createTestAggregateIdentifier();
    errorBus = createMockRabbitMessageBus(HermesError);
    eventBus = createMockRabbitMessageBus(HermesEvent);
    store = {
      verify: jest.fn(),
    };

    domain = new ChecksumDomain({
      errorBus,
      eventBus,
      logger,
      registry: createTestRegistry(),
      store,
    });

    await domain.registerHandlers();
  });

  test("should register event handler", async () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.checksum.hermes.test_aggregate.test_event_create",
      topic: "hermes.test_aggregate.test_event_create",
    });
  });

  test("should handle event", async () => {
    const event = createTestEvent(new TestEventCreate("create"), { aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event),
    ).resolves.toBeUndefined();

    expect(store.verify).toHaveBeenCalledWith(event);
  });

  test("should dispatch error event on invalid checksum", async () => {
    store.verify.mockRejectedValue(new ChecksumError("test"));

    const event = createTestEvent(new TestEventCreate("create"), { aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "checksum_error",
        data: {
          error: expect.objectContaining({ name: "ChecksumError" }),
          event: expect.objectContaining({ input: "create" }),
          message: event,
        },
      }),
    );
  });

  test("should emit error on invalid checksum", async () => {
    store.verify.mockRejectedValue(new ChecksumError("test"));

    const listener = jest.fn();

    domain.on("checksum", listener);

    const event = createTestEvent(new TestEventCreate("create"), { aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event),
    ).resolves.toBeUndefined();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ name: "ChecksumError" }),
        event: expect.objectContaining({ input: "create" }),
        message: event,
      }),
    );
  });
});
