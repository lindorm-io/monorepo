import type { IAmphora } from "../interfaces";
import { _createMockAmphora } from "./create-mock-amphora";

type MockAmphora = jest.Mocked<IAmphora>;

export const createMockAmphora = (): MockAmphora =>
  _createMockAmphora(jest.fn) as MockAmphora;
