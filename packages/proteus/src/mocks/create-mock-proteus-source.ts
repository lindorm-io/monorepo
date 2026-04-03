import { createMockRepository } from "./create-mock-repository";

export type MockProteusSource = {
  namespace: string | null;
  driverType: string;
  migrationsTable: string | undefined;
  log: Record<string, jest.Mock>;
  breaker: null;

  clone: jest.Mock;
  connect: jest.Mock;
  disconnect: jest.Mock;
  ping: jest.Mock;
  setup: jest.Mock;

  addEntities: jest.Mock;
  addSubscriber: jest.Mock;
  getEntityMetadata: jest.Mock;

  setFilterParams: jest.Mock;
  enableFilter: jest.Mock;
  disableFilter: jest.Mock;
  getFilterRegistry: jest.Mock;

  repository: jest.Mock;
  queryBuilder: jest.Mock;
  client: jest.Mock;
  transaction: jest.Mock;
};

export const createMockProteusSource = (): MockProteusSource => ({
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

  clone: jest.fn().mockImplementation(() => createMockProteusSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn().mockResolvedValue(true),
  setup: jest.fn(),

  addEntities: jest.fn(),
  addSubscriber: jest.fn(),
  getEntityMetadata: jest.fn().mockReturnValue([]),

  setFilterParams: jest.fn(),
  enableFilter: jest.fn(),
  disableFilter: jest.fn(),
  getFilterRegistry: jest.fn().mockReturnValue(new Map()),

  repository: jest.fn().mockImplementation(() => createMockRepository()),
  queryBuilder: jest.fn(),
  client: jest.fn(),
  transaction: jest.fn().mockImplementation(async (cb: Function) => cb({})),
});
