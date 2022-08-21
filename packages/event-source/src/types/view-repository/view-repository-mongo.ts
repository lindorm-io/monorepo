import { Filter, FindOptions } from "mongodb";
import { HandlerIdentifier } from "../handler";
import { IMongoConnection } from "@lindorm-io/mongo";
import { ViewStoreAttributes } from "../view-store";
import { State } from "../generic";
import { ViewRepositoryData } from "./view-repository";

export interface MongoViewRepositoryOptions {
  connection: IMongoConnection;
  view: HandlerIdentifier;
}

export interface IMongoRepository<S = State> {
  find(
    filter?: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S>>;
  findOne(
    find: Filter<ViewStoreAttributes>,
    options?: FindOptions<ViewStoreAttributes>,
  ): Promise<ViewRepositoryData<S>>;
}
