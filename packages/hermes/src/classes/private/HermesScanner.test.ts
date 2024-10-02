import { createMockLogger } from "@lindorm/logger";
import { join } from "path";
import { HermesScanner } from "./HermesScanner";

describe("HermesScanner", () => {
  let scanner: HermesScanner;

  beforeEach(() => {
    const root = join(__dirname, "..", "..", "..", "example");

    scanner = new HermesScanner(
      {
        checksumStore: {},
        encryptionStore: {},
        eventStore: {},
        messageBus: {},
        sagaStore: {},
        viewStore: {},

        context: "context",
        dangerouslyRegisterHandlersManually: false,
        directories: {
          aggregates: join(root, "aggregates"),
          queries: join(root, "queries"),
          sagas: join(root, "sagas"),
          views: join(root, "views"),
        },
        fileFilter: {
          include: [/.*/],
          exclude: [],
        },
        scanner: {},
      },
      createMockLogger(),
    );
  });

  test("should scan aggregates", async () => {
    await expect(scanner.scanAggregates()).resolves.not.toThrow();

    expect(scanner.aggregateCommandHandlers).toEqual([
      expect.objectContaining({
        commandName: "create_greeting",
      }),
      expect.objectContaining({
        commandName: "update_greeting",
      }),
      expect.objectContaining({
        commandName: "respond_greeting",
      }),
    ]);

    expect(scanner.aggregateEventHandlers).toEqual([
      expect.objectContaining({
        eventName: "greeting_created",
      }),
      expect.objectContaining({
        eventName: "greeting_updated",
      }),
      expect.objectContaining({
        eventName: "greeting_responded",
      }),
    ]);

    expect(scanner.checksumEventHandlers).toEqual([
      expect.objectContaining({
        eventName: "greeting_created",
      }),
      expect.objectContaining({
        eventName: "greeting_updated",
      }),
      expect.objectContaining({
        eventName: "greeting_responded",
      }),
    ]);

    expect(scanner.errorHandlers).toEqual([
      expect.objectContaining({
        errorName: "SagaDestroyedError",
      }),
    ]);

    expect(scanner.commandAggregates).toEqual({
      create_greeting: ["greeting"],
      respond_greeting: ["response"],
      update_greeting: ["greeting"],
    });

    expect(scanner.eventAggregates).toEqual({
      greeting_created: ["greeting"],
      greeting_responded: ["response"],
      greeting_updated: ["greeting"],
    });
  });

  test("should scan queries", async () => {
    await expect(scanner.scanQueries()).resolves.not.toThrow();

    expect(scanner.queryHandlers).toEqual([
      expect.objectContaining({
        queryName: "get_view_from_mongo",
      }),
      expect.objectContaining({
        queryName: "get_view_from_postgres",
      }),
    ]);
  });

  test("should scan sagas", async () => {
    await expect(scanner.scanAggregates()).resolves.not.toThrow();
    await expect(scanner.scanSagas()).resolves.not.toThrow();

    expect(scanner.sagaEventHandlers).toEqual([
      expect.objectContaining({
        eventName: "greeting_created",
      }),
      expect.objectContaining({
        eventName: "greeting_responded",
      }),
      expect.objectContaining({
        eventName: "greeting_updated",
      }),
    ]);
  });

  test("should scan views", async () => {
    await expect(scanner.scanAggregates()).resolves.not.toThrow();
    await expect(scanner.scanViews()).resolves.not.toThrow();

    expect(scanner.viewEventHandlers).toEqual([
      expect.objectContaining({
        adapter: { type: "mongo" },
        eventName: "greeting_created",
      }),
      expect.objectContaining({
        adapter: { type: "mongo" },
        eventName: "greeting_responded",
      }),
      expect.objectContaining({
        adapter: { type: "mongo" },
        eventName: "greeting_updated",
      }),
      expect.objectContaining({
        adapter: { type: "postgres" },
        eventName: "greeting_created",
      }),
      expect.objectContaining({
        adapter: { type: "postgres" },
        eventName: "greeting_responded",
      }),
      expect.objectContaining({
        adapter: { type: "postgres" },
        eventName: "greeting_updated",
      }),
    ]);
  });
});
