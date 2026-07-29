import type { ILogger } from "@lindorm/logger";
import type { IProteusSession } from "../interfaces/ProteusSession.js";
import type { CreateMockProteusSettings } from "./create-mock-proteus-settings.js";
import { createMemoryBackend } from "./mock-memory-backend.js";

/**
 * Build a mock ProteusSession backed by the REAL in-memory driver. Repositories
 * obtained from it delegate to the live memory driver, so writes round-trip and
 * generated fields are minted faithfully. The backing source is connected and
 * set up before the session is returned; seed rows the obvious way
 * (`await session.repository(E).insert([...])`). Every method is a spy.
 */
export const _createMockProteusSession = async (
  mockFn: () => any,
  createLogger: () => ILogger,
  settings?: CreateMockProteusSettings,
): Promise<IProteusSession> =>
  (await createMemoryBackend(mockFn, createLogger, settings)).makeFacadeSession();
