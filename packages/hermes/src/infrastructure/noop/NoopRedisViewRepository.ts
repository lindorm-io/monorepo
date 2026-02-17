import { LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { IRedisViewRepository } from "../../interfaces";
import { ViewRepositoryAttributes } from "../../types";

export class NoopRedisViewRepository<
  S extends Dict = Dict,
> implements IRedisViewRepository<S> {
  public find(): Promise<Array<ViewRepositoryAttributes<S>>> {
    throw new LindormError("Redis Connection not found");
  }

  public findById(): Promise<ViewRepositoryAttributes<S> | undefined> {
    throw new LindormError("Redis Connection not found");
  }

  public findOne(): Promise<ViewRepositoryAttributes<S> | undefined> {
    throw new LindormError("Redis Connection not found");
  }
}
