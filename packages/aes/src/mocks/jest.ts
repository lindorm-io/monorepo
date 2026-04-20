import { createMockKryptos } from "@lindorm/kryptos/mocks/jest";
import type { IAesKit } from "../interfaces";
import { _createMockAesKit } from "./create-mock-aes-kit";

type MockAesKit = jest.Mocked<IAesKit>;

export const createMockAesKit = (): MockAesKit =>
  _createMockAesKit(jest.fn, createMockKryptos()) as MockAesKit;
