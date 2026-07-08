import { vi, type Mocked } from "vitest";
import type { IConduit } from "../interfaces/index.js";
import { _createMockConduit } from "./create-mock-conduit.js";

type MockConduit = Mocked<IConduit>;

export const createMockConduit = (): MockConduit =>
  _createMockConduit(vi.fn) as MockConduit;
