import { Constructor } from "@lindorm/types";
import { IRedisEntity, IRedisSource } from "../interfaces";
import {
  createMockRedisEntityCallback,
  createMockRedisRepository,
} from "./mock-redis-repository";

export const createMockRedisSource = (): IRedisSource => ({
  client: {} as any,
  addEntities: jest.fn(),
  clone: jest.fn().mockImplementation(() => createMockRedisSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  setup: jest.fn(),
  repository: jest
    .fn()
    .mockImplementation((Entity: Constructor<IRedisEntity>) =>
      createMockRedisRepository(createMockRedisEntityCallback(Entity)),
    ),
});
