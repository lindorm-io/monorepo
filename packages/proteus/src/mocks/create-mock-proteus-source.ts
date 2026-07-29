import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "../interfaces/ProteusSource.js";
import type { CreateMockProteusSettings } from "./create-mock-proteus-settings.js";
import { createMemoryBackend } from "./mock-memory-backend.js";

/**
 * Build a mock ProteusSource backed by the REAL in-memory driver. Repositories
 * obtained directly off the source, or off a `session()` derived from it, share
 * one in-memory store — so writes are visible through both. The source is
 * connected and set up before it is returned; seed rows the obvious way
 * (`await source.session().repository(E).insert([...])`). Every method is a spy.
 */
export const _createMockProteusSource = async (
  mockFn: () => any,
  createLogger: () => ILogger,
  settings?: CreateMockProteusSettings,
): Promise<IProteusSource> =>
  (await createMemoryBackend(mockFn, createLogger, settings)).makeFacadeSource();
