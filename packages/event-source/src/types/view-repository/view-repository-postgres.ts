import { State } from "../generic";
import { ViewRepositoryData } from "./view-repository";
import { Filter } from "mongodb";

export interface PostgresFindFilter {
  where?: {
    text: string;
    values: Array<any>;
  };
  limit?: number;
  offset?: number;
  orderBy?: Record<string, "ASC" | "DESC">;
}

export interface PostgresFindOneFilter {
  where: {
    text: string;
    values: Array<any>;
  };
}

export interface IPostgresRepository<TState = State> {
  find(filter?: PostgresFindFilter): Promise<Array<ViewRepositoryData<TState>>>;
  findById(id: string): Promise<ViewRepositoryData<TState> | undefined>;
  findOne(filter: PostgresFindOneFilter): Promise<ViewRepositoryData<TState> | undefined>;
}

export type FindFilter<TState = State> = Filter<{
  id: string;
  state: TState;
  created_at: Date;
  updated_at: Date;
}>;
