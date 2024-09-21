import { Constructor } from "@lindorm/types";
import { IRedisEntity, IRedisSource } from "../interfaces";
import { createMockRedisRepository } from "./mock-redis-repository";

export const createMockRedisSource = (): IRedisSource => ({
  client: {} as any,
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  repository: jest
    .fn()
    .mockImplementation((Entity: Constructor<IRedisEntity>) =>
      createMockRedisRepository((args) => new Entity(args)),
    ),
});
