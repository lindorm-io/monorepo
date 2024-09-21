import { IMongoBucket, IMongoFile } from "../interfaces";

export type CreateMockFileCallback<F extends IMongoFile> = (options?: any) => F;

export const createMockMongoBucket = <F extends IMongoFile>(
  callback: CreateMockFileCallback<F>,
): IMongoBucket<F> => ({
  delete: jest.fn(),
  deleteByFilename: jest.fn(),
  download: jest.fn(),
  find: jest.fn().mockImplementation(async (criteria) => [callback(criteria)]),
  findOne: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneOrFail: jest.fn().mockImplementation(async (criteria) => callback(criteria)),
  findOneByFilename: jest
    .fn()
    .mockImplementation(async (filename) => callback({ filename })),
  findOneByFilenameOrFail: jest
    .fn()
    .mockImplementation(async (filename) => callback({ filename })),
  upload: jest.fn().mockImplementation(async (_, metadata) => callback(metadata)),
  setup: jest.fn(),
});
