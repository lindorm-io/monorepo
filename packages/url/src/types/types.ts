import { ChangeCase } from "@lindorm/case";
import { Dict, Param, Query } from "@lindorm/types";

export type CreateUrlOptions<P = Dict<Param>, Q = Dict<Query>> = {
  baseUrl?: string;
  changeQueryCase?: ChangeCase;
  host?: string;
  params?: P;
  port?: number;
  query?: Q;
};
