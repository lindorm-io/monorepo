import type { IHermesSession } from "../interfaces/IHermesSession";

export type MockHermesSession = jest.Mocked<IHermesSession>;

export const createMockHermesSession = (): MockHermesSession => ({
  status: "ready",
  command: jest
    .fn()
    .mockResolvedValue({ id: "mock-id", name: "mock", namespace: "mock" }),
  query: jest.fn().mockResolvedValue(undefined),
});
