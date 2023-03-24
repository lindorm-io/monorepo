import { ConnectionStatus } from "@lindorm-io/core-connection";
import { Db, MongoClient } from "mongodb";
import { IMongoConnection } from "../types";
import { MongoConnection } from "../connections";

type Options = {
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
};

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
  } as unknown as Db;

  const client = {
    connect: jest.fn(),
    close: jest.fn(),
    db: jest.fn().mockImplementation(() => db),
  } as unknown as MongoClient;

  const connection: IMongoConnection = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    client,

    status: ConnectionStatus.CONNECTED,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    database: db,

    on: jest.fn(),

    collection: jest.fn().mockImplementation(() => collection),
  };

  return connection as MongoConnection;
};
