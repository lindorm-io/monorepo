import { DeepPartial, Dict } from "@lindorm/types";
import { QueryConfig } from "pg";
import { InsertOptions, SelectOptions } from "../types";

export interface IPostgresQueryBuilder<T extends Dict> {
  insert(attribute: T, options?: InsertOptions<T>): QueryConfig;
  insertMany(attributes: Array<T>, options?: InsertOptions<T>): QueryConfig;
  select(criteria: DeepPartial<T>, options?: SelectOptions<T>): QueryConfig;
}
