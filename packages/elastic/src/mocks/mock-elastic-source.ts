import { IElasticSource } from "../interfaces";
import { createMockElasticRepository } from "./mock-elastic-repository";

export const createMockElasticSource = (): IElasticSource => ({
  client: {} as any,

  clone: jest.fn().mockImplementation(() => createMockElasticSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),

  addEntities: jest.fn(),
  repository: jest.fn().mockImplementation(createMockElasticRepository),
});
