import { Dict } from "@lindorm/types";
import { QueryConfig } from "pg";
import { InsertOptions, SelectOptions, UpdateOptions } from "../types";

export interface IPostgresQueryBuilder<T extends Dict> {
  insert(attributes: T, options?: InsertOptions<T>): QueryConfig;
  insertMany(array: Array<T>, options?: InsertOptions<T>): QueryConfig;
  select(criteria: Partial<T>, options?: SelectOptions<T>): QueryConfig;
  update(
    criteria: Partial<T>,
    attributes: Partial<T>,
    options?: UpdateOptions<T>,
  ): QueryConfig;
}
