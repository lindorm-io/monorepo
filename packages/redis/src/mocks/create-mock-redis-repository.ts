import { ILindormEntity, TestEntity } from "@lindorm-io/entity";
import { RedisRepository } from "../types";

type CreateEntityCallback = (options?: any) => ILindormEntity<any>;

export const createMockRedisRepository = (
  createEntityCallback: CreateEntityCallback = (options): ILindormEntity<any> =>
    new TestEntity(options),
): RedisRepository<any, any> => ({
  create: jest.fn().mockImplementation(async (entity) => entity),
  createMany: jest.fn().mockImplementation(async (entities) => entities),
  deleteMany: jest.fn(),
  destroy: jest.fn(),
  destroyMany: jest.fn(),
  find: jest.fn().mockImplementation(async (filter) => createEntityCallback(filter)),
  findMany: jest.fn().mockImplementation(async (filter) => [createEntityCallback(filter)]),
  findOrCreate: jest.fn().mockImplementation(async (filter) => createEntityCallback(filter)),
  tryFind: jest.fn().mockImplementation(async (filter) => createEntityCallback(filter)),
  ttl: jest.fn().mockImplementation(async () => 1),
  update: jest.fn().mockImplementation(async (entity) => entity),
  updateMany: jest.fn().mockImplementation(async (entities) => entities),
  upsert: jest.fn().mockImplementation(async (entity) => entity),
});
