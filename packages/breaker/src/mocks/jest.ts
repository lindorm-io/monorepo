import type { ICircuitBreaker } from "../interfaces/CircuitBreaker";
import { _createMockCircuitBreaker } from "./create-mock-circuit-breaker";

type MockCircuitBreaker = jest.Mocked<ICircuitBreaker>;

export const createMockCircuitBreaker = (): MockCircuitBreaker =>
  _createMockCircuitBreaker(jest.fn) as MockCircuitBreaker;
