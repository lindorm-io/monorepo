import { EntityOptions, ILindormEntity, TestEntity } from "@lindorm-io/entity";
import { IRepository } from "../types";

type CreateEntityCallback = (options?: EntityOptions) => ILindormEntity<any>;

export const createMockRepository = (
  createEntityCallback: CreateEntityCallback = (options) => new TestEntity(options),
): IRepository<any, any> => ({
  count: jest.fn().mockImplementation(async () => 1),
  create: jest.fn().mockImplementation(async (entity) => entity),
  createMany: jest.fn().mockImplementation(async (entities) => entities),
  deleteMany: jest.fn(),
  destroy: jest.fn(),
  destroyMany: jest.fn(),
  find: jest.fn().mockImplementation(async (filter) => createEntityCallback(filter)),
  findMany: jest.fn().mockImplementation(async (filter) => [createEntityCallback(filter)]),
  findOrCreate: jest.fn().mockImplementation(async (filter) => createEntityCallback(filter)),
  tryFind: jest.fn().mockImplementation(async (filter) => createEntityCallback(filter)),
  update: jest.fn().mockImplementation(async (entity) => entity),
  updateMany: jest.fn().mockImplementation(async (entities) => entities),
});
