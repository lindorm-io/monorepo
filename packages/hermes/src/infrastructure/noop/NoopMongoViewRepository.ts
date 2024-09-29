import { LindormError } from "@lindorm/errors";
import { Dict } from "@lindorm/types";
import { IMongoViewRepository } from "../../interfaces";
import { ViewRepositoryData } from "../../types";

export class NoopMongoViewRepository implements IMongoViewRepository {
  public find(): Promise<Array<ViewRepositoryData<Dict>>> {
    throw new LindormError("Mongo Connection not found");
  }

  public findById(): Promise<ViewRepositoryData<Dict> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }

  public findOne(): Promise<ViewRepositoryData<Dict> | undefined> {
    throw new LindormError("Mongo Connection not found");
  }
}
