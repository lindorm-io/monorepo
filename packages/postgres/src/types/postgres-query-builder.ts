import { Dict } from "@lindorm/types";

type Order = "ASC" | "DESC" | "asc" | "desc";

export type PostgresQueryBuilderOptions = {
  table: string;
};

export type InsertOptions<T extends Dict> = {
  returning?: "*" | Array<keyof T>;
};

export type SelectOptions<T extends Dict> = {
  columns?: "*" | Array<keyof T>;
  order?: { [key in keyof T]?: Order };
  limit?: number;
  offset?: number;
};

export type UpdateOptions<T extends Dict> = {
  returning?: "*" | Array<keyof T>;
};
