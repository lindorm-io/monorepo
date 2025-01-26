import { Constructor } from "@lindorm/types";
import { MongoBucket } from "../classes";
import { IMongoBucket, IMongoFile } from "../interfaces";

export type CreateMockFileCallback = (options?: any) => IMongoFile;

export const createMockMongoFileCallback =
  <F extends IMongoFile>(File: Constructor<F>): CreateMockFileCallback =>
  (options) =>
    MongoBucket.createFile(File, options);

export const createMockMongoBucket = <F extends IMongoFile>(
  callback: CreateMockFileCallback,
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
