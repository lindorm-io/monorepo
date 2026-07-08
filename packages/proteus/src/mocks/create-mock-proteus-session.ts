import type { IProteusSession } from "../interfaces/ProteusSession.js";
import { _createMockRepository } from "./create-mock-repository.js";
import type { MockProteusRows } from "./mock-proteus-rows.js";

export const _createMockProteusSession = (
  mockFn: () => any,
  rows?: MockProteusRows,
): IProteusSession => {
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
    log: {
      info: mockFn(),
      warn: mockFn(),
      error: mockFn(),
      debug: mockFn(),
      verbose: mockFn(),
      child: mockFn(),
      time: mockFn(),
    },

    setFilterParams: mockFn(),
    enableFilter: mockFn(),
    disableFilter: mockFn(),
    getFilterRegistry: returns(new Map()),

    hasEntity: returns(true),

    repository: impl((entity: any) =>
      _createMockRepository(mockFn, rows ? (rows[entity?.name] ?? []) : undefined),
    ),
    queryBuilder: mockFn(),
    client: mockFn(),
    transaction: impl(async (cb: Function) => cb({})),
    ping: resolves(true),

    getEmitEntity: returns(mockFn()),
  } as unknown as IProteusSession;
};
