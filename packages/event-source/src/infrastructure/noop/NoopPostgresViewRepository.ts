import { LindormError } from "@lindorm-io/errors";
import {
  IPostgresRepository,
  PostgresFindFilter,
  PostgresFindOneFilter,
  State,
  ViewRepositoryData,
} from "../../types";

export class NoopPostgresViewRepository implements IPostgresRepository {
  public find(filter?: PostgresFindFilter): Promise<Array<ViewRepositoryData<State>>> {
    throw new LindormError("Postgres Connection not found");
  }

  public findById(id: string): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }

  public findOne(filter: PostgresFindOneFilter): Promise<ViewRepositoryData<State> | undefined> {
    throw new LindormError("Postgres Connection not found");
  }
}
