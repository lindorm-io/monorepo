import type { Function } from "@lindorm/types";
import { vi, type Mocked } from "vitest";
import type { ILogger } from "../interfaces/index.js";
import { _createMockLogger } from "./create-mock-logger.js";

type MockLogger = Mocked<ILogger>;

export const createMockLogger = (logFn?: Function): MockLogger =>
  _createMockLogger(vi.fn, logFn) as MockLogger;
