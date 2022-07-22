import { MongoConnection } from "../connection";
import { ConnectionStatus } from "@lindorm-io/core-connection";
import { MongoClient } from "mongodb";

interface Options {
  insertOne?: jest.Mock;
  insertMany?: jest.Mock;
  bulkWrite?: jest.Mock;
  updateOne?: jest.Mock;
  replaceOne?: jest.Mock;
  updateMany?: jest.Mock;
  deleteOne?: jest.Mock;
  deleteMany?: jest.Mock;
  rename?: jest.Mock;
  drop?: jest.Mock;
  findOne?: jest.Mock;
  find?: jest.Mock;
  options?: jest.Mock;
  isCapped?: jest.Mock;
  createIndex?: jest.Mock;
  createIndexes?: jest.Mock;
  dropIndex?: jest.Mock;
  dropIndexes?: jest.Mock;
  listIndexes?: jest.Mock;
  indexExists?: jest.Mock;
  indexInformation?: jest.Mock;
  estimatedDocumentCount?: jest.Mock;
  countDocuments?: jest.Mock;
  distinct?: jest.Mock;
  indexes?: jest.Mock;
  stats?: jest.Mock;
  findOneAndDelete?: jest.Mock;
  findOneAndReplace?: jest.Mock;
  findOneAndUpdate?: jest.Mock;
  aggregate?: jest.Mock;
  watch?: jest.Mock;
  mapReduce?: jest.Mock;
  initializeUnorderedBulkOp?: jest.Mock;
  initializeOrderedBulkOp?: jest.Mock;
  insert?: jest.Mock;
  update?: jest.Mock;
  remove?: jest.Mock;
  count?: jest.Mock;
}

export const createMockMongoConnection = (o: Options = {}): MongoConnection => {
  const collection = {
    insertOne: o.insertOne || jest.fn(),
    insertMany: o.insertMany || jest.fn(),
    bulkWrite: o.bulkWrite || jest.fn(),
    updateOne: o.updateOne || jest.fn(),
    replaceOne: o.replaceOne || jest.fn(),
    updateMany: o.updateMany || jest.fn(),
    deleteOne: o.deleteOne || jest.fn(),
    deleteMany: o.deleteMany || jest.fn(),
    rename: o.rename || jest.fn(),
    drop: o.drop || jest.fn(),
    findOne: o.findOne || jest.fn(),
    find: o.find || jest.fn(),
    options: o.options || jest.fn(),
    isCapped: o.isCapped || jest.fn(),
    createIndex: o.createIndex || jest.fn(),
    createIndexes: o.createIndexes || jest.fn(),
    dropIndex: o.dropIndex || jest.fn(),
    dropIndexes: o.dropIndexes || jest.fn(),
    listIndexes: o.listIndexes || jest.fn(),
    indexExists: o.indexExists || jest.fn(),
    indexInformation: o.indexInformation || jest.fn(),
    estimatedDocumentCount: o.estimatedDocumentCount || jest.fn(),
    countDocuments: o.countDocuments || jest.fn(),
    distinct: o.distinct || jest.fn(),
    indexes: o.indexes || jest.fn(),
    stats: o.stats || jest.fn(),
    findOneAndDelete: o.findOneAndDelete || jest.fn(),
    findOneAndReplace: o.findOneAndReplace || jest.fn(),
    findOneAndUpdate: o.findOneAndUpdate || jest.fn(),
    aggregate: o.aggregate || jest.fn(),
    watch: o.watch || jest.fn(),
    mapReduce: o.mapReduce || jest.fn(),
    initializeUnorderedBulkOp: o.initializeUnorderedBulkOp || jest.fn(),
    initializeOrderedBulkOp: o.initializeOrderedBulkOp || jest.fn(),
    insert: o.insert || jest.fn(),
    update: o.update || jest.fn(),
    remove: o.remove || jest.fn(),
    count: o.count || jest.fn(),
  };

  const db = {
    collection: jest.fn().mockImplementation(() => collection),
  };

  const client = {
    connect: jest.fn(),
    close: jest.fn(),
    db: jest.fn().mockImplementation(() => db),
  } as unknown as MongoClient;

  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    client,
    status: ConnectionStatus.CONNECTED,
    on: jest.fn(),
  } as unknown as MongoConnection;
};
