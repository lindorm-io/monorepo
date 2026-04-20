import type { IKryptos } from "../interfaces";
import { _createMockKryptos } from "./create-mock-kryptos";

type MockKryptos = jest.Mocked<IKryptos>;

export const createMockKryptos = (overrides: Partial<IKryptos> = {}): MockKryptos =>
  _createMockKryptos(jest.fn, overrides) as MockKryptos;
