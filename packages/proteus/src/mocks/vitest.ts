import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Constructor } from "@lindorm/types";
import { vi, type Mocked } from "vitest";
import type { IEntity, IProteusRepository } from "../interfaces/index.js";
import type { IProteusSession } from "../interfaces/ProteusSession.js";
import type { IProteusSource } from "../interfaces/ProteusSource.js";
import type { CreateMockProteusSettings } from "./create-mock-proteus-settings.js";
import { _createMockProteusSession } from "./create-mock-proteus-session.js";
import { _createMockProteusSource } from "./create-mock-proteus-source.js";
import { _createMockRepository } from "./create-mock-repository.js";

export type { CreateMockProteusSettings } from "./create-mock-proteus-settings.js";

type MockProteusSource = Mocked<IProteusSource>;
type MockProteusSession = Mocked<IProteusSession>;
type MockProteusRepository<E extends IEntity = IEntity> = Mocked<IProteusRepository<E>>;

export const createMockProteusSource = async (
  settings?: CreateMockProteusSettings,
): Promise<MockProteusSource> =>
  (await _createMockProteusSource(
    vi.fn,
    createMockLogger,
    settings,
  )) as MockProteusSource;

export const createMockProteusSession = async (
  settings?: CreateMockProteusSettings,
): Promise<MockProteusSession> =>
  (await _createMockProteusSession(
    vi.fn,
    createMockLogger,
    settings,
  )) as MockProteusSession;

export const createMockRepository = async <E extends IEntity = IEntity>(
  entity?: Constructor<E>,
  settings?: CreateMockProteusSettings,
): Promise<MockProteusRepository<E>> =>
  (await _createMockRepository<E>(
    vi.fn,
    createMockLogger,
    entity,
    settings,
  )) as MockProteusRepository<E>;
