import { ILogger } from "@lindorm/logger";
import { MnemosRepository } from "../classes";
import { IMnemosCache } from "../interfaces";
import { TestEntity, TestEntityOptions } from "./test-entity";

export class TestRepository extends MnemosRepository<TestEntity, TestEntityOptions> {
  public constructor(cache: IMnemosCache, logger: ILogger) {
    super({ target: TestEntity, cache, logger });
  }
}
