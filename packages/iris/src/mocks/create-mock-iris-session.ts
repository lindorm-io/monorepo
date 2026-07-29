import type { ILogger } from "@lindorm/logger";
import type { IIrisSession } from "../interfaces/index.js";
import type { CreateMockIrisSettings } from "./create-mock-iris-settings.js";
import { createMemoryIrisBackend } from "./mock-memory-backend.js";

/**
 * Build a mock IrisSession backed by the REAL in-memory driver. Surfaces obtained
 * from it delegate to the live memory driver, so a published message really
 * reaches its subscribers. The backing source is connected and set up before the
 * session is returned; assert via real delivery (subscribe, `await publish`,
 * check the callback fired). Every method is a spy.
 */
export const _createMockIrisSession = async (
  mockFn: () => any,
  createLogger: () => ILogger,
  settings?: CreateMockIrisSettings,
): Promise<IIrisSession> =>
  (await createMemoryIrisBackend(mockFn, createLogger, settings)).makeFacadeSession();
