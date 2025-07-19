import { defaultCreateEntity, IEntity } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { noop } from "@lindorm/utils";
import { IMnemosRepository } from "../interfaces";

type Callback<E extends IEntity = IEntity> = (options?: any) => E;

const defaultCallback =
  <E extends IEntity = IEntity>(Entity: Constructor<E>): Callback<E> =>
  (options) =>
    defaultCreateEntity(Entity, options);

export const createMockMnemosRepository = <E extends IEntity = IEntity>(
  target: Constructor<E>,
  callback: Callback<E> = defaultCallback(target),
): jest.Mocked<IMnemosRepository<E>> => ({
  create: jest.fn().mockImplementation((args) => callback(args)),
  copy: jest.fn().mockImplementation((args) => callback(args)),
  validate: jest.fn(),

  count: jest.fn().mockResolvedValue(1),
  delete: jest.fn().mockImplementation(noop),
  destroy: jest.fn().mockImplementation(noop),
  destroyBulk: jest.fn().mockImplementation(noop),
  exists: jest.fn().mockResolvedValue(true),
  find: jest.fn().mockImplementation((criteria) => [callback(criteria)]),
  findOne: jest.fn().mockImplementation((criteria) => callback(criteria)),
  findOneOrFail: jest.fn().mockImplementation((criteria) => callback(criteria)),
  findOneOrSave: jest.fn().mockImplementation((criteria) => callback(criteria)),
  insert: jest.fn().mockImplementation((entity) => entity),
  insertBulk: jest.fn().mockImplementation((array) => array),
  save: jest.fn().mockImplementation((entity) => entity),
  saveBulk: jest.fn().mockImplementation((array) => array),
  update: jest.fn().mockImplementation((entity) => entity),
  updateBulk: jest.fn().mockImplementation((array) => array),
  ttl: jest.fn().mockResolvedValue(60),
});
