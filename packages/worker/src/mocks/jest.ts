/// <reference types="jest" />
import type { ILindormWorker } from "../interfaces/LindormWorker.js";
import { _createMockWorker } from "./create-mock-worker.js";

type MockWorker = jest.Mocked<ILindormWorker>;

export const createMockWorker = (): MockWorker =>
  _createMockWorker(jest.fn) as MockWorker;
