import type { ILindormWorker } from "../interfaces/LindormWorker";
import { _createMockWorker } from "./create-mock-worker";

type MockWorker = jest.Mocked<ILindormWorker>;

export const createMockWorker = (): MockWorker =>
  _createMockWorker(jest.fn) as MockWorker;
