import { IAmphora } from "../interfaces";

export const createMockAmphora = (): IAmphora => ({
  config: [],
  issuer: "mock_issuer",
  jwks: {
    keys: [],
  },
  vault: [],

  add: jest.fn(),
  filter: jest.fn().mockRejectedValue([]),
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
