import type { ILogger } from "@lindorm/logger";
import type { IIrisSource } from "../interfaces/index.js";
import type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";
import { createMemoryIrisBackend } from "./mock-memory-backend.js";

/**
 * Build a mock IrisSource backed by the REAL in-memory driver. Message buses,
 * publishers, worker queues and RPC clients obtained off the source (or off a
 * `session()` derived from it) share one in-memory driver — so a published
 * message really reaches its subscribers. The source is connected and set up
 * before it is returned; assert via real delivery (subscribe, `await publish`,
 * check the callback fired). Every method is a spy.
 */
export const _createMockIrisSource = async (
  mockFn: () => any,
  createLogger: () => ILogger,
  settings?: CreateMockIrisSettings,
): Promise<IIrisSource> =>
  (await createMemoryIrisBackend(mockFn, createLogger, settings)).makeFacadeSource();
