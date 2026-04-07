import { IAmphora } from "../interfaces";

export type MockAmphora = jest.Mocked<IAmphora>;

export const createMockAmphora = (): MockAmphora => ({
  config: [],
  domain: "mock_issuer",
  jwks: {
    keys: [],
  },
  vault: [],

  add: jest.fn(),
  env: jest.fn(),
  filter: jest.fn().mockResolvedValue([]),
  filterSync: jest.fn().mockReturnValue([]),
  find: jest.fn().mockResolvedValue("mock_kryptos"),
  findSync: jest.fn().mockReturnValue("mock_kryptos"),
  refresh: jest.fn().mockResolvedValue(undefined),
  setup: jest.fn().mockResolvedValue(undefined),

  canEncrypt: jest.fn().mockReturnValue(true),
  canDecrypt: jest.fn().mockReturnValue(true),

  canSign: jest.fn().mockReturnValue(true),
  canVerify: jest.fn().mockReturnValue(true),
});
