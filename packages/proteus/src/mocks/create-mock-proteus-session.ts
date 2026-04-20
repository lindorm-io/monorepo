import type { IProteusSession } from "../interfaces/ProteusSession";
import { _createMockRepository } from "./create-mock-repository";

export const _createMockProteusSession = (mockFn: () => any): IProteusSession => {
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

    repository: impl(() => _createMockRepository(mockFn)),
    queryBuilder: mockFn(),
    client: mockFn(),
    transaction: impl(async (cb: Function) => cb({})),
    ping: resolves(true),

    getEmitEntity: returns(mockFn()),
  } as unknown as IProteusSession;
};
