import type { IHermes } from "../interfaces/IHermes";
import type { IHermesSession } from "../interfaces/IHermesSession";
import { _createMockHermes } from "./create-mock-hermes";
import { _createMockHermesSession } from "./create-mock-hermes-session";

type MockHermes = jest.Mocked<IHermes>;
type MockHermesSession = jest.Mocked<IHermesSession>;

export const createMockHermes = (): MockHermes =>
  _createMockHermes(jest.fn) as MockHermes;

export const createMockHermesSession = (): MockHermesSession =>
  _createMockHermesSession(jest.fn) as MockHermesSession;
