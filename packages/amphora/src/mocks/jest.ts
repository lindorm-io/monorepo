import type { IAmphora } from "../interfaces/index.js";
import { _createMockAmphora } from "./create-mock-amphora.js";

type MockAmphora = jest.Mocked<IAmphora>;

export const createMockAmphora = (): MockAmphora =>
  _createMockAmphora(jest.fn) as MockAmphora;
