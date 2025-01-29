import { IEntityBase } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { IMnemosSource } from "../interfaces";
import {
  createMockMnemosEntityCallback,
  createMockMnemosRepository,
} from "./mock-mnemos-repository";

export const createMockMnemosSource = (): IMnemosSource => ({
  client: {} as any,
  addEntities: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockMnemosSource()),
  repository: jest
    .fn()
    .mockImplementation((Entity: Constructor<IEntityBase>) =>
      createMockMnemosRepository(createMockMnemosEntityCallback(Entity)),
    ),
});
