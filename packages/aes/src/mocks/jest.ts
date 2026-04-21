import { createMockKryptos } from "@lindorm/kryptos/mocks/jest";
import type { IAesKit } from "../interfaces/index.js";
import { _createMockAesKit } from "./create-mock-aes-kit.js";

type MockAesKit = jest.Mocked<IAesKit>;

export const createMockAesKit = (): MockAesKit =>
  _createMockAesKit(jest.fn, createMockKryptos()) as MockAesKit;
