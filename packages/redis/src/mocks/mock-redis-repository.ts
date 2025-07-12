import { defaultCreateEntity, IEntity } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { noopAsync } from "@lindorm/utils";
import { IRedisRepository } from "../interfaces";

type Callback<E extends IEntity = IEntity> = (options?: any) => E;

const defaultCallback =
  <E extends IEntity = IEntity>(target: Constructor<E>): Callback<E> =>
  (options) =>
    defaultCreateEntity(target, options);

export const createMockRedisRepository = <E extends IEntity = IEntity>(
  target: Constructor<E>,
  callback: Callback<E> = defaultCallback(target),
): IRedisRepository<E> => ({
  create: jest.fn().mockImplementation((args) => callback(args)),
  copy: jest.fn().mockImplementation((args) => callback(args)),
  validate: jest.fn(),
  setup: jest.fn().mockImplementation(noopAsync),

  clone: jest.fn().mockImplementation(async (entity) => entity),
  cloneBulk: jest.fn().mockImplementation(async (array) => array),
  count: jest.fn().mockResolvedValue(1),
  delete: jest.fn().mockImplementation(noopAsync),
  destroy: jest.fn().mockImplementation(noopAsync),
  destroyBulk: jest.fn().mockImplementation(noopAsync),
  exists: jest.fn().mockReturnValue(true),
  find: jest.fn().mockImplementation(async (criteria) => [callback(criteria)]),
  findOne: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrFail: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrSave: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  insert: jest.fn().mockImplementation(async (entity) => entity),
  insertBulk: jest.fn().mockImplementation(async (array) => array),
  save: jest.fn().mockImplementation(async (entity) => entity),
  saveBulk: jest.fn().mockImplementation(async (array) => array),
  ttl: jest.fn().mockResolvedValue(60),
  update: jest.fn().mockImplementation(async (entity) => entity),
  updateBulk: jest.fn().mockImplementation(async (array) => array),
});
