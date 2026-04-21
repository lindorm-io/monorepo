import type { IHermesSession } from "../interfaces/IHermesSession.js";

export const _createMockHermesSession = (mockFn: () => any): IHermesSession => {
  const resolves = (value: any) => {
    const m = mockFn();
    m.mockResolvedValue(value);
    return m;
  };

  return {
    status: "ready",
    command: resolves({ id: "mock-id", name: "mock", namespace: "mock" }),
    query: resolves(undefined),
  } as unknown as IHermesSession;
};
