import { createMockRepository } from "./create-mock-repository";
import { NotSupportedError } from "../errors";

export type MockProteusClone = {
  namespace: string | null;
  driverType: string;
  migrationsTable: undefined;
  log: Record<string, jest.Mock>;
  breaker: null;

  on: jest.Mock;
  off: jest.Mock;
  once: jest.Mock;

  clone: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  ping: jest.Mock;
  setup: jest.Mock;

  addEntities: jest.Mock;
  getEntityMetadata: jest.Mock;

  setFilterParams: jest.Mock;
  enableFilter: jest.Mock;
  disableFilter: jest.Mock;
  getFilterRegistry: jest.Mock;

  repository: jest.Mock;
  queryBuilder: jest.Mock;
  client: jest.Mock;
  transaction: jest.Mock;

  getEmitEntity: jest.Mock;
};

export const createMockProteusClone = (): MockProteusClone => ({
  namespace: null,
  driverType: "memory",
  migrationsTable: undefined,
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    child: jest.fn(),
    time: jest.fn(),
  },
  breaker: null,

  on: jest.fn().mockImplementation(() => {
    throw new NotSupportedError("Cannot register listeners on a cloned ProteusSource");
  }),
  off: jest.fn().mockImplementation(() => {
    throw new NotSupportedError("Cannot register listeners on a cloned ProteusSource");
  }),
  once: jest.fn().mockImplementation(() => {
    throw new NotSupportedError("Cannot register listeners on a cloned ProteusSource");
  }),

  clone: jest.fn().mockImplementation(() => {
    throw new NotSupportedError("Cannot clone a cloned ProteusSource");
  }),
  connect: jest
    .fn()
    .mockRejectedValue(
      new NotSupportedError("Cannot call connect() on a cloned ProteusSource"),
    ),
  disconnect: jest
    .fn()
    .mockRejectedValue(
      new NotSupportedError("Cannot call disconnect() on a cloned ProteusSource"),
    ),
  ping: jest.fn().mockResolvedValue(true),
  setup: jest
    .fn()
    .mockRejectedValue(
      new NotSupportedError("Cannot call setup() on a cloned ProteusSource"),
    ),

  addEntities: jest.fn().mockImplementation(() => {
    throw new NotSupportedError("Cannot add entities to a cloned ProteusSource");
  }),
  getEntityMetadata: jest.fn().mockImplementation(() => {
    throw new NotSupportedError("Cannot get entity metadata from a cloned ProteusSource");
  }),

  setFilterParams: jest.fn(),
  enableFilter: jest.fn(),
  disableFilter: jest.fn(),
  getFilterRegistry: jest.fn().mockReturnValue(new Map()),

  repository: jest.fn().mockImplementation(() => createMockRepository()),
  queryBuilder: jest.fn(),
  client: jest.fn(),
  transaction: jest.fn().mockImplementation(async (cb: Function) => cb({})),

  getEmitEntity: jest.fn().mockReturnValue(jest.fn()),
});
