import { vi, type Mocked } from "vitest";
import type { IKryptos } from "../interfaces/index.js";
import { _createMockKryptos } from "./create-mock-kryptos.js";

type MockKryptos = Mocked<IKryptos>;

export const createMockKryptos = (overrides: Partial<IKryptos> = {}): MockKryptos =>
  _createMockKryptos(vi.fn, overrides) as MockKryptos;
