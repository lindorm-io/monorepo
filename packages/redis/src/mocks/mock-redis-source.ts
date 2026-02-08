import { IRedisSource } from "../interfaces";
import { createMockRedisMessageBus } from "./mock-redis-message-bus";
import { createMockRedisPublisher } from "./mock-redis-publisher";
import { createMockRedisRepository } from "./mock-redis-repository";

export const createMockRedisSource = (): IRedisSource => ({
  __instanceof: "RedisSource",
  client: {} as any,

  clone: jest.fn().mockImplementation(() => createMockRedisSource()),
  connect: jest.fn(),
  disconnect: jest.fn(),
  ping: jest.fn(),
  setup: jest.fn(),

  addEntities: jest.fn(),
  addMessages: jest.fn(),

  hasEntity: jest.fn().mockReturnValue(true),
  hasMessage: jest.fn().mockReturnValue(true),

  messageBus: jest.fn().mockImplementation((target) => createMockRedisMessageBus(target)),
  publisher: jest.fn().mockImplementation((target) => createMockRedisPublisher(target)),
  repository: jest.fn().mockImplementation((target) => createMockRedisRepository(target)),
});
