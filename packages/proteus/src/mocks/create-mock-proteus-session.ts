import { createMockRepository } from "./create-mock-repository";

export type MockProteusSession = {
  namespace: string | null;
  driverType: string;
  log: Record<string, jest.Mock>;

  setFilterParams: jest.Mock;
  enableFilter: jest.Mock;
  disableFilter: jest.Mock;
  getFilterRegistry: jest.Mock;

  repository: jest.Mock;
  queryBuilder: jest.Mock;
  client: jest.Mock;
  transaction: jest.Mock;
  ping: jest.Mock;

  getEmitEntity: jest.Mock;
};

export const createMockProteusSession = (): MockProteusSession => ({
  namespace: null,
  driverType: "memory",
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    child: jest.fn(),
    time: jest.fn(),
  },

  setFilterParams: jest.fn(),
  enableFilter: jest.fn(),
  disableFilter: jest.fn(),
  getFilterRegistry: jest.fn().mockReturnValue(new Map()),

  repository: jest.fn().mockImplementation(() => createMockRepository()),
  queryBuilder: jest.fn(),
  client: jest.fn(),
  transaction: jest.fn().mockImplementation(async (cb: Function) => cb({})),
  ping: jest.fn().mockResolvedValue(true),

  getEmitEntity: jest.fn().mockReturnValue(jest.fn()),
});
