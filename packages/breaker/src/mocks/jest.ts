/// <reference types="jest" />
import type { ICircuitBreaker } from "../interfaces/CircuitBreaker.js";
import { _createMockCircuitBreaker } from "./create-mock-circuit-breaker.js";

type MockCircuitBreaker = jest.Mocked<ICircuitBreaker>;

export const createMockCircuitBreaker = (): MockCircuitBreaker =>
  _createMockCircuitBreaker(jest.fn) as MockCircuitBreaker;
