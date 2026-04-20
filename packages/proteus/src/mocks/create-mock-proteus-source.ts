import type { IProteusSource } from "../interfaces/ProteusSource";
import { _createMockProteusSession } from "./create-mock-proteus-session";
import { _createMockRepository } from "./create-mock-repository";

export const _createMockProteusSource = (mockFn: () => any): IProteusSource => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const returns = (value: any) => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  return {
    namespace: null,
    driverType: "memory",
    migrationsTable: undefined,
    log: {
      info: mockFn(),
      warn: mockFn(),
      error: mockFn(),
      debug: mockFn(),
      verbose: mockFn(),
      child: mockFn(),
      time: mockFn(),
    },
    breaker: null,

    on: mockFn(),
    off: mockFn(),
    once: mockFn(),

    session: impl(() => _createMockProteusSession(mockFn)),
    connect: mockFn(),
    disconnect: mockFn(),
    ping: resolves(true),
    setup: mockFn(),

    addEntities: mockFn(),
    getEntityMetadata: returns([]),

    setFilterParams: mockFn(),
    enableFilter: mockFn(),
    disableFilter: mockFn(),
    getFilterRegistry: returns(new Map()),

    repository: impl(() => _createMockRepository(mockFn)),
    queryBuilder: mockFn(),
    client: mockFn(),
    transaction: impl(async (cb: Function) => cb({})),
  } as unknown as IProteusSource;
};
