import { LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { IRedisViewRepository } from "../../interfaces";
import { ViewRepositoryData } from "../../types";

export class NoopRedisViewRepository implements IRedisViewRepository {
  public find(): Promise<Array<ViewRepositoryData<Dict>>> {
    throw new LindormError("Redis Connection not found");
  }

  public findById(): Promise<ViewRepositoryData<Dict> | undefined> {
    throw new LindormError("Redis Connection not found");
  }

  public findOne(): Promise<ViewRepositoryData<Dict> | undefined> {
    throw new LindormError("Redis Connection not found");
  }
}
