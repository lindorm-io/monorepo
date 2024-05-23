import { IAmphora } from "../types";

export const createMockAmphora = (): IAmphora => ({
  config: [],
  jwks: {
    keys: [],
  },
  vault: [],

  add: jest.fn(),
  filter: jest.fn().mockRejectedValue([]),
  find: jest.fn().mockResolvedValue("mock_kryptos"),
  refresh: jest.fn().mockResolvedValue(undefined),
  setup: jest.fn().mockResolvedValue(undefined),
});
