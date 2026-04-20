import type { IHermes } from "../interfaces/IHermes";
import { _createMockHermesSession } from "./create-mock-hermes-session";

export const _createMockHermes = (mockFn: () => any): IHermes => {
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
  const replayHandle = () =>
    returns({
      on: mockFn(),
      cancel: mockFn(),
      promise: Promise.resolve(),
    });

  return {
    status: "ready",

    setup: mockFn(),
    teardown: mockFn(),
    session: impl(() => _createMockHermesSession(mockFn)),

    command: resolves({ id: "mock-id", name: "mock", namespace: "mock" }),
    query: resolves(undefined),
    on: mockFn(),
    off: mockFn(),

    admin: {
      inspect: {
        aggregate: resolves(undefined),
        saga: resolves(null),
        view: resolves(null),
      },
      purgeCausations: resolves(0),
      replay: {
        view: replayHandle(),
        aggregate: replayHandle(),
      },
    },
  } as unknown as IHermes;
};
