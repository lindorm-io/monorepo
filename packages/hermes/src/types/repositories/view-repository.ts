import { Criteria, SelectOptions } from "@lindorm/postgres";
import { Dict, Predicate } from "@lindorm/types";
import { Filter, FindOptions } from "mongodb";

export type ViewRepositoryAttributes<S extends Dict = Dict> = {
  id: string;
  state: S;
  created_at: Date;
  updated_at: Date;
};

type Attributes<S extends Dict = Dict> = ViewRepositoryAttributes<S> & {
  destroyed: boolean;
};

export type MongoFindCriteria<S extends Dict = Dict> = Filter<Attributes<S>>;

export type MongoFindOptions<S extends Dict = Dict> = FindOptions<Attributes<S>>;

export type PostgresFindCriteria<S extends Dict = Dict> = Criteria<Attributes<S>>;

export type PostgresFindOptions<S extends Dict = Dict> = SelectOptions<Attributes<S>>;

export type RedisFindCriteria<S extends Dict = Dict> = Predicate<Attributes<S>>;
