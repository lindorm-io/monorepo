/// <reference types="jest" />
import type { IConduit } from "../interfaces/index.js";
import { _createMockConduit } from "./create-mock-conduit.js";

type MockConduit = jest.Mocked<IConduit>;

export const createMockConduit = (): MockConduit =>
  _createMockConduit(jest.fn) as MockConduit;
