import type { Function } from "@lindorm/types";
import type { ILogger } from "../interfaces";
import { _createMockLogger } from "./create-mock-logger";

type MockLogger = jest.Mocked<ILogger>;

export const createMockLogger = (logFn?: Function): MockLogger =>
  _createMockLogger(jest.fn, logFn) as MockLogger;
