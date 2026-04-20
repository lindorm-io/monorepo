import { createMockAesKit } from "@lindorm/aes/mocks/vitest";
import { vi, type Mocked } from "vitest";
import type { IAegis } from "../interfaces/index.js";
import { _createMockAegis } from "./create-mock-aegis.js";

type MockAegis = Mocked<IAegis>;

export const createMockAegis = (): MockAegis =>
  _createMockAegis(vi.fn, createMockAesKit()) as MockAegis;
