/// <reference types="jest" />
import type { IKryptos } from "../interfaces/index.js";
import { _createMockKryptos } from "./create-mock-kryptos.js";

type MockKryptos = jest.Mocked<IKryptos>;

export const createMockKryptos = (overrides: Partial<IKryptos> = {}): MockKryptos =>
  _createMockKryptos(jest.fn, overrides) as MockKryptos;
