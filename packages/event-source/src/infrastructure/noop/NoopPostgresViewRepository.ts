import { LindormError } from "@lindorm-io/errors";
import { IPostgresRepository, State, ViewRepositoryData } from "../../types";

export class NoopPostgresViewRepository implements IPostgresRepository {
  public find(): Promise<Array<ViewRepositoryData<State>>> {
    throw new LindormError("Postgres Connection not found");
  }

  public findById(): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }

  public findOne(): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }
}
