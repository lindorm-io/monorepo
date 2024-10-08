import { LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { IMongoViewRepository } from "../../interfaces";
import { ViewRepositoryAttributes } from "../../types";

export class NoopMongoViewRepository<S extends Dict = Dict>
  implements IMongoViewRepository<S>
{
  public find(): Promise<Array<ViewRepositoryAttributes<S>>> {
    throw new LindormError("Mongo Connection not found");
  }

  public findById(): Promise<ViewRepositoryAttributes<S> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }

  public findOne(): Promise<ViewRepositoryAttributes<S> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }
}
