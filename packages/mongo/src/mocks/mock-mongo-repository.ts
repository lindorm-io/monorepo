import { IMongoEntity, IMongoRepository } from "../interfaces";

export type CreateMockEntityCallback = (options?: any) => IMongoEntity;

const updateEntity = (entity: IMongoEntity): IMongoEntity => {
  entity.rev = entity.rev + 1;
  entity.updatedAt = new Date();
  return entity;
};

export const createMockMongoRepository = <E extends IMongoEntity>(
  callback: CreateMockEntityCallback,
): IMongoRepository<E> => ({
  count: jest.fn().mockResolvedValue(1),
  create: jest.fn().mockImplementation((args) => callback(args)),
  delete: jest.fn(),
  deleteById: jest.fn(),
  deleteExpired: jest.fn(),
  destroy: jest.fn(),
  destroyBulk: jest.fn(),
  exists: jest.fn().mockReturnValue(true),
  find: jest.fn().mockImplementation(async (criteria) => [callback(criteria)]),
  findOne: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrFail: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrSave: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneById: jest.fn().mockImplementation(async (id) => callback({ id })),
  findOneByIdOrFail: jest.fn().mockImplementation(async (id) => callback({ id })),
  insert: jest.fn().mockImplementation(async (entity) => updateEntity(entity)),
  insertBulk: jest.fn().mockImplementation(async (array) => array.map(updateEntity)),
  save: jest.fn().mockImplementation(async (entity) => updateEntity(entity)),
  saveBulk: jest.fn().mockImplementation(async (array) => array.map(updateEntity)),
  softDelete: jest.fn(),
  softDeleteById: jest.fn(),
  softDestroy: jest.fn(),
  softDestroyBulk: jest.fn(),
  update: jest.fn().mockImplementation(async (entity) => updateEntity(entity)),
  updateBulk: jest.fn().mockImplementation(async (array) => array.map(updateEntity)),
  ttl: jest.fn().mockResolvedValue(60),
  ttlById: jest.fn().mockResolvedValue(60),
  setup: jest.fn(),
});
