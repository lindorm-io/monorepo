import { Dict } from "@lindorm/types";

type Order = "ASC" | "DESC" | "asc" | "desc";

export type PostgresQueryBuilderOptions = {
  table: string;
};

export type ReturningOptions<T extends Dict> = {
  returning?: true | Array<keyof T>;
};

export type InsertOptions<T extends Dict> = ReturningOptions<T>;

export type SelectAggregate<T extends Dict> = {
  function: "COUNT" | "SUM" | "AVG";
  column: keyof T;
};

export type SelectColumns<T extends Dict> = {
  [key in keyof T]: true | 1 | string;
};

export type SelectOrder<T extends Dict> = {
  [key in keyof T]?: Order;
};

export type SelectOptions<T extends Dict> = {
  aggregate?: SelectAggregate<T>;
  columns?: Array<keyof T> | SelectColumns<T>;
  distinct?: boolean;
  limit?: number;
  offset?: number;
  order?: SelectOrder<T>;
  page?: number;
  pageSize?: number;
};

export type UpdateOptions<T extends Dict> = ReturningOptions<T>;
