import type { HermesStatus } from "../types/hermes-status";

export type MockHermesSession = {
  status: HermesStatus;

  command: jest.Mock;
  query: jest.Mock;
};

export const createMockHermesSession = (): MockHermesSession => ({
  status: "ready",

  command: jest
    .fn()
    .mockResolvedValue({ id: "mock-id", name: "mock", namespace: "mock" }),
  query: jest.fn().mockResolvedValue(undefined),
});
