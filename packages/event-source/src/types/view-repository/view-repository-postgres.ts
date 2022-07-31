import { FindManyOptions } from "typeorm/find-options/FindManyOptions";
import { FindOneOptions } from "typeorm";
import { IPostgresConnection } from "@lindorm-io/postgres";
import { State } from "../generic";
import { ViewEntity } from "../../infrastructure";
import { ViewRepositoryData } from "./view-repository";

export interface PostgresViewRepositoryOptions {
  connection: IPostgresConnection;
  viewEntity: typeof ViewEntity;
}

export interface IPostgresRepository<S = State> {
  find(filter: FindManyOptions<ViewEntity>): Promise<Array<ViewRepositoryData<S>>>;
  findById(id: string): Promise<ViewRepositoryData<S>>;
  findOne(filter: FindOneOptions<ViewEntity>): Promise<ViewRepositoryData<S>>;
}
