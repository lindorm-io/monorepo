import { IAmphora } from "../interfaces";

export const _createMockAmphora = (mockFn: () => any): IAmphora => {
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
    config: [],
    domain: "mock_issuer",
    jwks: { keys: [] },
    vault: [],

    add: mockFn(),
    env: mockFn(),
    filter: resolves([]),
    filterSync: returns([]),
    find: resolves("mock_kryptos"),
    findById: resolves("mock_kryptos"),
    findByIdSync: returns("mock_kryptos"),
    findSync: returns("mock_kryptos"),
    refresh: resolves(undefined),
    setup: resolves(undefined),

    canEncrypt: returns(true),
    canDecrypt: returns(true),

    canSign: returns(true),
    canVerify: returns(true),
  } as unknown as IAmphora;
};
