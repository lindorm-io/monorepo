import { LindormError } from "@lindorm-io/errors";
import { IMongoRepository, State, ViewRepositoryData } from "../../types";

export class NoopMongoViewRepository implements IMongoRepository {
  public find(): Promise<Array<ViewRepositoryData<State>>> {
    throw new LindormError("Mongo Connection not found");
  }

  public findById(): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }

  public findOne(): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }
}
