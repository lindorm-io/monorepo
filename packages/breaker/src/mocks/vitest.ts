import { vi, type Mocked } from "vitest";
import type { ICircuitBreaker } from "../interfaces/CircuitBreaker.js";
import { _createMockCircuitBreaker } from "./create-mock-circuit-breaker.js";

type MockCircuitBreaker = Mocked<ICircuitBreaker>;

export const createMockCircuitBreaker = (): MockCircuitBreaker =>
  _createMockCircuitBreaker(vi.fn) as MockCircuitBreaker;
