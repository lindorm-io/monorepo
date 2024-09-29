import { Dict } from "@lindorm/types";
import { Filter } from "mongodb";

export type PostgresViewRepositoryFindFilter = {
  where?: {
    text: string;
    values: Array<any>;
  };
  limit?: number;
  offset?: number;
  orderBy?: Record<string, "ASC" | "DESC">;
};

export type PostgresViewRepositoryFindOneFilter = {
  where: {
    text: string;
    values: Array<any>;
  };
};

export type FindFilter<S extends Dict = Dict> = Filter<{
  id: string;
  state: S;
  created_at: Date;
  updated_at: Date;
}>;
