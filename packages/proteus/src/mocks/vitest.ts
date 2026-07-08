import { vi, type Mocked } from "vitest";
import type { IEntity, IProteusRepository } from "../interfaces/index.js";
import type { IProteusSession } from "../interfaces/ProteusSession.js";
import type { IProteusSource } from "../interfaces/ProteusSource.js";
import { _createMockProteusSession } from "./create-mock-proteus-session.js";
import { _createMockProteusSource } from "./create-mock-proteus-source.js";
import { _createMockRepository } from "./create-mock-repository.js";
import type { MockProteusRows } from "./mock-proteus-rows.js";

export type { MockProteusRows } from "./mock-proteus-rows.js";

type EntityFactory<E extends IEntity = IEntity> = (options?: any) => E;

type MockProteusSource = Mocked<IProteusSource>;
type MockProteusSession = Mocked<IProteusSession>;
type MockProteusRepository<E extends IEntity = IEntity> = Mocked<IProteusRepository<E>>;

export const createMockProteusSource = (rows?: MockProteusRows): MockProteusSource =>
  _createMockProteusSource(vi.fn, rows) as MockProteusSource;

export const createMockProteusSession = (rows?: MockProteusRows): MockProteusSession =>
  _createMockProteusSession(vi.fn, rows) as MockProteusSession;

export const createMockRepository = <E extends IEntity = IEntity>(
  rows?: Array<E>,
  factory?: EntityFactory<E>,
): MockProteusRepository<E> =>
  _createMockRepository<E>(vi.fn, rows, factory) as MockProteusRepository<E>;
