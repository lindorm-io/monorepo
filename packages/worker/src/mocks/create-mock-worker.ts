import type { ILindormWorker } from "../interfaces/LindormWorker";

export type MockWorker = ILindormWorker & {
  destroy: jest.Mock;
  health: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
  trigger: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;
  once: jest.Mock;
};

export const createMockWorker = (): MockWorker => ({
  alias: "mock",
  latestError: null,
  latestStart: null,
  latestStop: null,
  latestSuccess: null,
  latestTry: null,
  running: false,
  seq: 0,
  started: false,

  destroy: jest.fn().mockResolvedValue(undefined),
  health: jest.fn().mockReturnValue({
    alias: "mock",
    started: false,
    running: false,
    destroyed: false,
    seq: 0,
    latestSuccess: null,
    latestError: null,
    latestTry: null,
  }),
  start: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  trigger: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
});
