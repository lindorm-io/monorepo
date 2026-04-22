/// <reference types="jest" />
import { createMockAesKit } from "@lindorm/aes/mocks/jest";
import type { IAegis } from "../interfaces/index.js";
import { _createMockAegis } from "./create-mock-aegis.js";

type MockAegis = jest.Mocked<IAegis>;

export const createMockAegis = (): MockAegis =>
  _createMockAegis(jest.fn, createMockAesKit()) as MockAegis;
