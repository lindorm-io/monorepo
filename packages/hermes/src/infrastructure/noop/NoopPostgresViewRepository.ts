import { LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { IPostgresViewRepository } from "../../interfaces";
import { ViewRepositoryAttributes } from "../../types";

export class NoopPostgresViewRepository<S extends Dict = Dict>
  implements IPostgresViewRepository<S>
{
  public find(): Promise<Array<ViewRepositoryAttributes<S>>> {
    throw new LindormError("Postgres Connection not found");
  }

  public findById(): Promise<ViewRepositoryAttributes<S> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }

  public findOne(): Promise<ViewRepositoryAttributes<S> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }
}
