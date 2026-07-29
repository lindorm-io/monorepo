import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisPublisher, IMessage } from "../interfaces/index.js";
import type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";
import { createMemoryIrisBackend } from "./mock-memory-backend.js";

/**
 * Build a mock publisher backed by the REAL in-memory driver for the given
 * `@Message` class. A published message is delivered to subscribers on the same
 * source in-process. Assert the call surface (`pub.publish.mock.calls`), or pair
 * it with a `createMockIrisSource` subscriber to assert real delivery. Every
 * method stays a spy — override any default with `mockResolvedValueOnce` etc.
 */
export const _createMockPublisher = async <M extends IMessage = IMessage>(
  mockFn: () => any,
  createLogger: () => ILogger,
  target: Constructor<M>,
  settings?: CreateMockIrisSettings,
): Promise<IIrisPublisher<M>> => {
  const backend = await createMemoryIrisBackend(mockFn, createLogger, {
    ...settings,
    messages: [target, ...(settings?.messages ?? [])],
  });
  return backend.makeFacadePublisher(target);
};
