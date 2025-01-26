import { Constructor } from "@lindorm/types";
import { IElasticEntity, IElasticSource } from "../interfaces";
import {
  createMockElasticEntityCallback,
  createMockElasticRepository,
} from "./mock-elastic-repository";

export const createMockElasticSource = (): IElasticSource => ({
  client: {} as any,
  addEntities: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockElasticSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  repository: jest
    .fn()
    .mockImplementation((Entity: Constructor<IElasticEntity>) =>
      createMockElasticRepository(createMockElasticEntityCallback(Entity)),
    ),
});
