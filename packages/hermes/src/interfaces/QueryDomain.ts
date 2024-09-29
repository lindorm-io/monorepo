import { ClassLike, Dict } from "@lindorm/types";
import { IHermesQueryHandler } from "./QueryHandler";

export interface IQueryDomain<Q extends ClassLike = ClassLike, S extends Dict = Dict> {
  registerQueryHandler(queryHandler: IHermesQueryHandler<Q, any, S>): void;
  query<R>(query: Q): Promise<R>;
}
