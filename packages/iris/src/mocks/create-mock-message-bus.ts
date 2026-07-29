import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisMessageBus, IMessage } from "../interfaces/index.js";
import type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";
import { createMemoryIrisBackend } from "./mock-memory-backend.js";

/**
 * Build a mock message bus backed by the REAL in-memory driver for the given
 * `@Message` class. A published message is delivered to the bus's own
 * subscribers in-process (delivery is awaited inline), so assert the round-trip:
 * `subscribe`, `await publish(msg)`, then check the callback fired. Every method
 * stays a spy — assert `bus.publish.mock.calls`, or override any default with
 * `mockResolvedValueOnce` etc.
 */
export const _createMockMessageBus = async <M extends IMessage = IMessage>(
  mockFn: () => any,
  createLogger: () => ILogger,
  target: Constructor<M>,
  settings?: CreateMockIrisSettings,
): Promise<IIrisMessageBus<M>> => {
  const backend = await createMemoryIrisBackend(mockFn, createLogger, {
    ...settings,
    messages: [target, ...(settings?.messages ?? [])],
  });
  return backend.makeFacadeMessageBus(target);
};
