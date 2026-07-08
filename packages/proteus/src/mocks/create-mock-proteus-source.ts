import type { IProteusSource } from "../interfaces/ProteusSource.js";
import { _createMockProteusSession } from "./create-mock-proteus-session.js";
import { _createMockRepository } from "./create-mock-repository.js";
import type { MockProteusRows } from "./mock-proteus-rows.js";

export const _createMockProteusSource = (
  mockFn: () => any,
  rows?: MockProteusRows,
): IProteusSource => {
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

    session: impl(() => _createMockProteusSession(mockFn, rows)),
    connect: mockFn(),
    disconnect: mockFn(),
    ping: resolves(true),
    setup: mockFn(),

    addEntities: mockFn(),
    getEntityMetadata: returns([]),
    hasEntity: returns(true),

    setFilterParams: mockFn(),
    enableFilter: mockFn(),
    disableFilter: mockFn(),
    getFilterRegistry: returns(new Map()),

    repository: impl((entity: any) =>
      _createMockRepository(mockFn, rows ? (rows[entity?.name] ??= []) : undefined),
    ),
    queryBuilder: mockFn(),
    client: mockFn(),
    transaction: impl(async (cb: Function) => cb({})),
  } as unknown as IProteusSource;
};
