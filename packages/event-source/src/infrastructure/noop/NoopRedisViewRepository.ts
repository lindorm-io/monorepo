import { LindormError } from "@lindorm-io/errors";
import { IRedisRepository, State, ViewRepositoryData } from "../../types";

export class NoopRedisViewRepository implements IRedisRepository {
  public find(): Promise<Array<ViewRepositoryData<State>>> {
    throw new LindormError("Redis Connection not found");
  }

  public findById(): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Redis Connection not found");
  }

  public findOne(): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Redis Connection not found");
  }
}
