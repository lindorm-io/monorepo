import type { IEntity, IProteusRepository } from "../interfaces";
import type { IProteusSession } from "../interfaces/ProteusSession";
import type { IProteusSource } from "../interfaces/ProteusSource";
import { _createMockProteusSession } from "./create-mock-proteus-session";
import { _createMockProteusSource } from "./create-mock-proteus-source";
import { _createMockRepository } from "./create-mock-repository";

type EntityFactory<E extends IEntity = IEntity> = (options?: any) => E;

type MockProteusSource = jest.Mocked<IProteusSource>;
type MockProteusSession = jest.Mocked<IProteusSession>;
type MockProteusRepository<E extends IEntity = IEntity> = jest.Mocked<
  IProteusRepository<E>
>;

export const createMockProteusSource = (): MockProteusSource =>
  _createMockProteusSource(jest.fn) as MockProteusSource;

export const createMockProteusSession = (): MockProteusSession =>
  _createMockProteusSession(jest.fn) as MockProteusSession;

export const createMockRepository = <E extends IEntity = IEntity>(
  factory?: EntityFactory<E>,
): MockProteusRepository<E> =>
  _createMockRepository<E>(jest.fn, factory) as MockProteusRepository<E>;
