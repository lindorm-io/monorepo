import type { ILindormWorker } from "../interfaces/LindormWorker";

export const _createMockWorker = (mockFn: () => any): ILindormWorker => {
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
    alias: "mock",
    latestError: null,
    latestStart: null,
    latestStop: null,
    latestSuccess: null,
    latestTry: null,
    running: false,
    seq: 0,
    started: false,

    destroy: resolves(undefined),
    health: returns({
      alias: "mock",
      started: false,
      running: false,
      destroyed: false,
      seq: 0,
      latestSuccess: null,
      latestError: null,
      latestTry: null,
    }),
    start: mockFn(),
    stop: resolves(undefined),
    trigger: resolves(undefined),
    on: mockFn(),
    off: mockFn(),
    once: mockFn(),
  } as unknown as ILindormWorker;
};
