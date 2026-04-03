import { createMockLogger } from "@lindorm/logger";
import { join } from "path";
import { PylonListener } from "../../classes/PylonListener";
import { PylonListenerScanner } from "./PylonListenerScanner";
import { listenerRootMiddleware } from "../../__fixtures__/listeners/_middleware";
import { chatMiddleware } from "../../__fixtures__/listeners/chat/_middleware";

describe("PylonListenerScanner", () => {
  const logger = createMockLogger();
  const directory = join(__dirname, "..", "..", "__fixtures__", "listeners");
  const scanner = new PylonListenerScanner(logger);

  test("should return listeners", () => {
    const result = scanner.scan(directory);

    expect(result.listeners.length).toBeGreaterThan(0);

    for (const listener of result.listeners) {
      expect(listener).toBeInstanceOf(PylonListener);
    }
  });

  test("should create listeners with colon-separated event names", () => {
    const result = scanner.scan(directory);

    const events = result.listeners.flatMap((l) => l.listeners.map((e: any) => e.event));

    expect(events).toContain("chat:message");
  });

  test("should handle parameterized event segments", () => {
    const result = scanner.scan(directory);

    const events = result.listeners.flatMap((l) => l.listeners.map((e: any) => e.event));

    expect(events).toEqual(
      expect.arrayContaining([
        expect.stringContaining(":roomId:join"),
        expect.stringContaining(":roomId:leave"),
      ]),
    );
  });

  test("should support ONCE method", () => {
    const result = scanner.scan(directory);

    const methods = result.listeners.flatMap((l) =>
      l.listeners.map((e: any) => ({ event: e.event, method: e.method })),
    );

    expect(methods).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "once" })]),
    );
  });

  test("should inherit middleware from _middleware.ts files", () => {
    const result = scanner.scan(directory);

    // Chat message listener should have root + chat middleware
    const chatListener = result.listeners.find((l) =>
      l.listeners.some((e: any) => e.event === "chat:message"),
    );

    expect(chatListener).toBeDefined();
    expect(chatListener!.middleware).toEqual(
      expect.arrayContaining([listenerRootMiddleware, chatMiddleware]),
    );
  });

  test("should apply root middleware to all listeners", () => {
    const result = scanner.scan(directory);

    for (const listener of result.listeners) {
      expect(listener.middleware).toEqual(
        expect.arrayContaining([listenerRootMiddleware]),
      );
    }
  });
});
