import type { ICircuitBreaker } from "../interfaces/CircuitBreaker.js";

export const _createMockCircuitBreaker = (mockFn: () => any): ICircuitBreaker => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };

  return {
    name: "mock",
    state: "closed",
    isOpen: false,
    isClosed: true,
    isHalfOpen: false,

    execute: impl(async (fn: () => Promise<unknown>) => fn()),
    open: mockFn(),
    close: mockFn(),
    reset: mockFn(),
    on: mockFn(),
  } as unknown as ICircuitBreaker;
};
