import type { ICircuitBreaker } from "../interfaces/CircuitBreaker";

export type MockCircuitBreaker = ICircuitBreaker & {
  execute: jest.Mock;
  reset: jest.Mock;
};

export const createMockCircuitBreaker = (): MockCircuitBreaker => ({
  name: "mock",
  state: "closed",
  isOpen: false,
  isClosed: true,
  isHalfOpen: false,

  execute: jest.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
  reset: jest.fn(),
});
