import { vi, type Mocked } from "vitest";
import type { IEntity, IProteusRepository } from "../interfaces/index.js";
import type { IProteusSession } from "../interfaces/ProteusSession.js";
import type { IProteusSource } from "../interfaces/ProteusSource.js";
import { _createMockProteusSession } from "./create-mock-proteus-session.js";
import { _createMockProteusSource } from "./create-mock-proteus-source.js";
import { _createMockRepository } from "./create-mock-repository.js";

type EntityFactory<E extends IEntity = IEntity> = (options?: any) => E;

type MockProteusSource = Mocked<IProteusSource>;
type MockProteusSession = Mocked<IProteusSession>;
type MockProteusRepository<E extends IEntity = IEntity> = Mocked<IProteusRepository<E>>;

export const createMockProteusSource = (): MockProteusSource =>
  _createMockProteusSource(vi.fn) as MockProteusSource;

export const createMockProteusSession = (): MockProteusSession =>
  _createMockProteusSession(vi.fn) as MockProteusSession;

export const createMockRepository = <E extends IEntity = IEntity>(
  factory?: EntityFactory<E>,
): MockProteusRepository<E> =>
  _createMockRepository<E>(vi.fn, factory) as MockProteusRepository<E>;
