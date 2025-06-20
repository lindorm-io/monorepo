import { IMnemosSource } from "../interfaces";
import { createMockMnemosRepository } from "./mock-mnemos-repository";

export const createMockMnemosSource = (): IMnemosSource => ({
  client: {} as any,

  clone: jest.fn().mockImplementation(createMockMnemosSource),

  addEntities: jest.fn(),
  repository: jest.fn().mockImplementation(createMockMnemosRepository),
});
