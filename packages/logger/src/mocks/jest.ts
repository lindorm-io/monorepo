/// <reference types="jest" />
import type { Function } from "@lindorm/types";
import type { ILogger } from "../interfaces/index.js";
import { _createMockLogger } from "./create-mock-logger.js";

type MockLogger = jest.Mocked<ILogger>;

export const createMockLogger = (logFn?: Function): MockLogger =>
  _createMockLogger(jest.fn, logFn) as MockLogger;
