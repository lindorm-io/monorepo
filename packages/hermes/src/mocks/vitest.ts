import { vi, type Mocked } from "vitest";
import type { IHermes } from "../interfaces/IHermes.js";
import type { IHermesSession } from "../interfaces/IHermesSession.js";
import { _createMockHermes } from "./create-mock-hermes.js";
import { _createMockHermesSession } from "./create-mock-hermes-session.js";

type MockHermes = Mocked<IHermes>;
type MockHermesSession = Mocked<IHermesSession>;

export const createMockHermes = (): MockHermes => _createMockHermes(vi.fn) as MockHermes;

export const createMockHermesSession = (): MockHermesSession =>
  _createMockHermesSession(vi.fn) as MockHermesSession;
