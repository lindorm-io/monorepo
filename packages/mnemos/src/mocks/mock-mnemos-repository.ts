import { IEntity } from "@lindorm/entity";
import { IMnemosRepository } from "../interfaces";

export type CreateMockEntityCallback = (options?: any) => IEntity;

const updateEntity = (entity: IEntity): IEntity => {
  entity.updatedAt = new Date();
  return entity;
};

export const createMockMnemosRepository = <E extends IEntity>(
  callback: CreateMockEntityCallback,
): IMnemosRepository<E> => ({
  count: jest.fn().mockResolvedValue(1),
  create: jest.fn().mockImplementation((args) => callback(args)),
  delete: jest.fn(),
  deleteById: jest.fn(),
  destroy: jest.fn(),
  destroyBulk: jest.fn(),
  exists: jest.fn().mockReturnValue(true),
  find: jest.fn().mockImplementation((criteria) => [callback(criteria)]),
  findOne: jest.fn().mockImplementation((criteria) => callback(criteria)),
  findOneOrFail: jest.fn().mockImplementation((criteria) => callback(criteria)),
  findOneOrSave: jest.fn().mockImplementation((criteria) => callback(criteria)),
  findOneById: jest.fn().mockImplementation((id) => callback({ id })),
  findOneByIdOrFail: jest.fn().mockImplementation((id) => callback({ id })),
  insert: jest.fn().mockImplementation((entity) => updateEntity(entity)),
  insertBulk: jest.fn().mockImplementation((array) => array.map(updateEntity)),
  save: jest.fn().mockImplementation((entity) => updateEntity(entity)),
  saveBulk: jest.fn().mockImplementation((array) => array.map(updateEntity)),
  update: jest.fn().mockImplementation((entity) => updateEntity(entity)),
  updateBulk: jest.fn().mockImplementation((array) => array.map(updateEntity)),
  ttl: jest.fn().mockResolvedValue(60),
  ttlById: jest.fn().mockResolvedValue(60),
});
