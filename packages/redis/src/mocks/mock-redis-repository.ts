import { Constructor } from "@lindorm/types";
import { RedisRepository } from "../classes";
import { IRedisEntity, IRedisRepository } from "../interfaces";

export type CreateMockEntityCallback = (options?: any) => IRedisEntity;

const updateEntity = (entity: IRedisEntity): IRedisEntity => {
  entity.updatedAt = new Date();
  return entity;
};

export const createMockRedisEntityCallback =
  <E extends IRedisEntity>(Entity: Constructor<E>): CreateMockEntityCallback =>
  (options) =>
    RedisRepository.createEntity(Entity, options);

export const createMockRedisRepository = <E extends IRedisEntity>(
  callback: CreateMockEntityCallback,
): IRedisRepository<E> => ({
  count: jest.fn().mockResolvedValue(1),
  create: jest.fn().mockImplementation((args) => callback(args)),
  delete: jest.fn(),
  deleteById: jest.fn(),
  destroy: jest.fn(),
  destroyBulk: jest.fn(),
  exists: jest.fn().mockReturnValue(true),
  find: jest.fn().mockImplementation(async (criteria) => [callback(criteria)]),
  findOne: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrFail: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrSave: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneById: jest.fn().mockImplementation(async (id) => callback({ id })),
  findOneByIdOrFail: jest.fn().mockImplementation(async (id) => callback({ id })),
  save: jest.fn().mockImplementation(async (entity) => updateEntity(entity)),
  saveBulk: jest.fn().mockImplementation(async (array) => array.map(updateEntity)),
  ttl: jest.fn().mockResolvedValue(60),
  ttlById: jest.fn().mockResolvedValue(60),
});
