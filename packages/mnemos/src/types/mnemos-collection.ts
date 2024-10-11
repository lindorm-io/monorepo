import { Dict } from "@lindorm/types";

export type MnemosConstraint<T extends Dict = Dict> = {
  unique: Array<keyof T>;
  nullable?: Array<keyof T>;
};

export type MnemosCollectionOptions<T extends Dict = Dict> = {
  constraints?: Array<MnemosConstraint<T>>;
};
