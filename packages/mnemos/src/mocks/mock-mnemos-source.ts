import { IMnemosSource } from "../interfaces";
import { createMockMnemosRepository } from "./mock-mnemos-repository";

export const createMockMnemosSource = (): jest.Mocked<IMnemosSource> => ({
  name: "MnemosSource",
  client: {} as any,

  clone: jest.fn().mockImplementation(createMockMnemosSource),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),

  addEntities: jest.fn(),

  hasEntity: jest.fn().mockReturnValue(true),

  repository: jest
    .fn()
    .mockImplementation((target) => createMockMnemosRepository(target)),
});
