import { vi, type Mocked } from "vitest";
import type { ILindormWorker } from "../interfaces/LindormWorker.js";
import { _createMockWorker } from "./create-mock-worker.js";

type MockWorker = Mocked<ILindormWorker>;

export const createMockWorker = (): MockWorker => _createMockWorker(vi.fn) as MockWorker;
