import type { IHermes } from "../interfaces/IHermes.js";
import type { IHermesSession } from "../interfaces/IHermesSession.js";
import { _createMockHermes } from "./create-mock-hermes.js";
import { _createMockHermesSession } from "./create-mock-hermes-session.js";

type MockHermes = jest.Mocked<IHermes>;
type MockHermesSession = jest.Mocked<IHermesSession>;

export const createMockHermes = (): MockHermes =>
  _createMockHermes(jest.fn) as MockHermes;

export const createMockHermesSession = (): MockHermesSession =>
  _createMockHermesSession(jest.fn) as MockHermesSession;
