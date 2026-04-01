import type { HermesStatus } from "../types/hermes-status";

export type MockHermes = {
  status: HermesStatus;

  setup: jest.Mock;
  teardown: jest.Mock;
  clone: jest.Mock;

  command: jest.Mock;
  query: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;

  admin: {
    inspect: {
      aggregate: jest.Mock;
      saga: jest.Mock;
      view: jest.Mock;
    };
    purgeCausations: jest.Mock;
    replay: {
      view: jest.Mock;
      aggregate: jest.Mock;
    };
  };
};

export const createMockHermes = (): MockHermes => ({
  status: "ready",

  setup: jest.fn(),
  teardown: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockHermes()),

  command: jest
    .fn()
    .mockResolvedValue({ id: "mock-id", name: "mock", namespace: "mock" }),
  query: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),

  admin: {
    inspect: {
      aggregate: jest.fn().mockResolvedValue(undefined),
      saga: jest.fn().mockResolvedValue(null),
      view: jest.fn().mockResolvedValue(null),
    },
    purgeCausations: jest.fn().mockResolvedValue(0),
    replay: {
      view: jest.fn().mockReturnValue({
        on: jest.fn(),
        cancel: jest.fn(),
        promise: Promise.resolve(),
      }),
      aggregate: jest.fn().mockReturnValue({
        on: jest.fn(),
        cancel: jest.fn(),
        promise: Promise.resolve(),
      }),
    },
  },
});
