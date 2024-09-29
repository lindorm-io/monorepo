import { LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { IPostgresViewRepository } from "../../interfaces";
import { ViewRepositoryData } from "../../types";

export class NoopPostgresViewRepository implements IPostgresViewRepository {
  public find(): Promise<Array<ViewRepositoryData<Dict>>> {
    throw new LindormError("Postgres Connection not found");
  }

  public findById(): Promise<ViewRepositoryData<Dict> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }

  public findOne(): Promise<ViewRepositoryData<Dict> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }
}
