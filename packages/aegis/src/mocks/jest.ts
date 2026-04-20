import { createMockAesKit } from "@lindorm/aes/mocks/jest";
import type { IAegis } from "../interfaces";
import { _createMockAegis } from "./create-mock-aegis";

type MockAegis = jest.Mocked<IAegis>;

export const createMockAegis = (): MockAegis =>
  _createMockAegis(jest.fn, createMockAesKit()) as MockAegis;
