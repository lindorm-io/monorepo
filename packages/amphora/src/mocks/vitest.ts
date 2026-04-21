import { vi, type Mocked } from "vitest";
import type { IAmphora } from "../interfaces/index.js";
import { _createMockAmphora } from "./create-mock-amphora.js";

type MockAmphora = Mocked<IAmphora>;

export const createMockAmphora = (): MockAmphora =>
  _createMockAmphora(vi.fn) as MockAmphora;
