import { Filter, FindOptions } from "mongodb";
import { HandlerIdentifier } from "../handler";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoViewStoreAttributes } from "../view-store";
import { State } from "../generic";
import { ViewRepositoryData } from "./view-repository";

export interface MongoViewRepositoryOptions {
  collection?: string;
  connection: IMongoConnection;
  view: HandlerIdentifier;
}

export interface IMongoRepository<S = State> {
  find(
    filter?: Filter<MongoViewStoreAttributes>,
    options?: FindOptions<MongoViewStoreAttributes>,
  ): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S>>;
  findOne(
    find: Filter<MongoViewStoreAttributes>,
    options?: FindOptions<MongoViewStoreAttributes>,
  ): Promise<ViewRepositoryData<S>>;
}
