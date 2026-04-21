import { createMockKryptos } from "@lindorm/kryptos/mocks/vitest";
import { vi, type Mocked } from "vitest";
import type { IAesKit } from "../interfaces/index.js";
import { _createMockAesKit } from "./create-mock-aes-kit.js";

type MockAesKit = Mocked<IAesKit>;

export const createMockAesKit = (): MockAesKit =>
  _createMockAesKit(vi.fn, createMockKryptos()) as MockAesKit;
