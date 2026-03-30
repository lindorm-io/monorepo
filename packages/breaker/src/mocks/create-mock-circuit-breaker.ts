import type { ICircuitBreaker } from "../interfaces/CircuitBreaker";

export type MockCircuitBreaker = ICircuitBreaker & {
  execute: jest.Mock;
  open: jest.Mock;
  close: jest.Mock;
  reset: jest.Mock;
  on: jest.Mock;
};

export const createMockCircuitBreaker = (): MockCircuitBreaker => ({
  name: "mock",
  state: "closed",
  isOpen: false,
  isClosed: true,
  isHalfOpen: false,

  execute: jest.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
  open: jest.fn(),
  close: jest.fn(),
  reset: jest.fn(),
  on: jest.fn(),
});
