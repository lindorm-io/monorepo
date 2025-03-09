import { IRedisSource } from "../interfaces";
import { createMockRedisRepository } from "./mock-redis-repository";

export const createMockRedisSource = (): IRedisSource => ({
  client: {} as any,

  clone: jest.fn().mockImplementation(() => createMockRedisSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),

  addEntities: jest.fn(),
  repository: jest.fn().mockImplementation(createMockRedisRepository),
});
