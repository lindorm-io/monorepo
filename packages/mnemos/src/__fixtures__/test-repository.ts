import { ILogger } from "@lindorm/logger";
import { MnemosRepository } from "../classes";
import { IMnemosCache } from "../interfaces";
import { TestEntity } from "./test-entity";

export class TestRepository extends MnemosRepository<TestEntity> {
  public constructor(cache: IMnemosCache, logger: ILogger) {
    super({
      Entity: TestEntity,
      cache,
      logger,
    });
  }
}
