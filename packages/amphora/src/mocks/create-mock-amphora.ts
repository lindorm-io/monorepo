import type { IAmphora } from "../interfaces/index.js";
import type { AmphoraExternalConfig } from "../types/index.js";

const MOCK_IDP_CONFIG: AmphoraExternalConfig = {
  input: {},
  load: false,
  issuer: "mock_issuer",
  jwksUri: "mock_jwks_uri",
  openIdConfiguration: null,
  keyCount: 0,
  lastRefresh: null,
};

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

    external: {
      add: mockFn(),
      remove: mockFn(),
      addIssuer: resolves(undefined),
      removeIssuer: mockFn(),
      issuers: returns([]),
      refresh: resolves(undefined),
    },

    idp: {
      set: resolves(undefined),
      config: returns(MOCK_IDP_CONFIG),
      refresh: resolves(undefined),
      clear: mockFn(),
    },

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
