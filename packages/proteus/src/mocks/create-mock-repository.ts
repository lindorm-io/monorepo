import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IEntity, IProteusRepository } from "../interfaces/index.js";
import type { CreateMockProteusSettings } from "./create-mock-proteus-settings.js";
import { createBareRepository, createMemoryBackend } from "./mock-memory-backend.js";

/**
 * Build a mock repository.
 *
 * With a decorated `entity` class the repository is backed by the REAL in-memory
 * Proteus driver: every default resolves exactly like a live memory query, writes
 * round-trip, and `@Generated`/`@Version`/date fields are minted faithfully. Seed
 * rows the obvious way (`await repo.insert([...])`). Every method stays a spy —
 * override any default with `mockResolvedValueOnce` etc.
 *
 * Without an `entity` the repository is a bare spy stub (no store): trivial
 * defaults (`count → 1`, `exists → true`, `find → []`, writes echo) for
 * boundary-wiring, where consumers override the methods they exercise.
 */
export const _createMockRepository = async <E extends IEntity = IEntity>(
  mockFn: () => any,
  createLogger: () => ILogger,
  entity?: Constructor<E>,
  settings?: CreateMockProteusSettings,
): Promise<IProteusRepository<E>> => {
  if (!entity) return createBareRepository<E>(mockFn);

  const backend = await createMemoryBackend(mockFn, createLogger, {
    ...settings,
    entities: [entity, ...(settings?.entities ?? [])],
  });
  return backend.makeFacadeRepo(entity) as IProteusRepository<E>;
};
