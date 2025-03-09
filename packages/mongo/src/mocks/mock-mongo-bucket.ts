import { defaultCreateEntity } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { IMongoBucket, IMongoFile } from "../interfaces";

type Callback<F extends IMongoFile = IMongoFile> = (options?: any) => F;

const defaultCallback =
  <F extends IMongoFile = IMongoFile>(Entity: Constructor<F>): Callback<F> =>
  (options) =>
    defaultCreateEntity(Entity, options);

export const createMockMongoBucket = <F extends IMongoFile = IMongoFile>(
  Entity: Constructor<F>,
  callback: Callback<F> = defaultCallback(Entity),
): IMongoBucket<F> => ({
  setup: jest.fn(),

  delete: jest.fn(),
  download: jest.fn(),
  find: jest.fn().mockImplementation(async (criteria) => [callback(criteria)]),
  findOne: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrFail: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  upload: jest.fn().mockImplementation(async (_, metadata) => callback(metadata)),
});
