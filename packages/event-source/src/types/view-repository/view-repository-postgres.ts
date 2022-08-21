import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm";
import { HandlerIdentifier } from "../handler";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { State } from "../generic";
import { ViewEntity } from "../../infrastructure";
import { ViewRepositoryData } from "./view-repository";

export interface PostgresViewRepositoryOptions {
  connection: IPostgresConnection;
  ViewEntity: typeof ViewEntity;
  view: HandlerIdentifier;
}

export interface IPostgresRepository<S = State> {
  find(filter: FindManyOptions<ViewEntity>): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S>>;
  findOne(filter: FindOneOptions<ViewEntity>): Promise<ViewRepositoryData<S>>;
}
