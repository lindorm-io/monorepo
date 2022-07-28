import { ConnectionStatus } from "@lindorm-io/core-connection";
import { IMongoConnection } from "../types";
import { ClientSession, MongoClient } from "mongodb";
import { MongoConnection } from "../connection";
import { createMockLogger } from "@lindorm-io/winston";

interface Options {
  [key: string]: jest.Mock;

  insertOne?: jest.Mock;
  insertMany?: jest.Mock;
  updateOne?: jest.Mock;
  updateMany?: jest.Mock;
  deleteOne?: jest.Mock;
  deleteMany?: jest.Mock;
  findOne?: jest.Mock;
  find?: jest.Mock;
  createIndex?: jest.Mock;
  createIndexes?: jest.Mock;
  countDocuments?: jest.Mock;
  findOneAndDelete?: jest.Mock;
  findOneAndReplace?: jest.Mock;
  findOneAndUpdate?: jest.Mock;
  insert?: jest.Mock;
  update?: jest.Mock;
  remove?: jest.Mock;
  count?: jest.Mock;
}

export const createMockMongoConnection = (o: Options = {}): MongoConnection => {
  const collection = {
    insertOne: jest.fn(),
    insertMany: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createIndex: jest.fn(),
    createIndexes: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndDelete: jest.fn(),
    findOneAndReplace: jest.fn(),
    findOneAndUpdate: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    ...o,
  };

  const db = {
    collection: jest.fn().mockImplementation(() => collection),
  };

  const client = {
    connect: jest.fn(),
    close: jest.fn(),
    db: jest.fn().mockImplementation(() => db),
  } as unknown as MongoClient;

  const session = {
    endSession: jest.fn(),
    incrementTransactionNumber: jest.fn(),
    inTransaction: true,
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
  } as unknown as ClientSession;

  const connection: IMongoConnection = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    client,

    status: ConnectionStatus.CONNECTED,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,

    on: jest.fn(),

    collection: jest.fn().mockImplementation(() => collection),
    withTransaction: jest
      .fn()
      .mockImplementation(async (callback) =>
        callback({ client, session, logger: createMockLogger() }),
      ),
  };

  return connection as MongoConnection;
};
