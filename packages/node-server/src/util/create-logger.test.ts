import { createLogger } from "./create-logger";
import { Environment } from "@lindorm-io/koa";
import { Logger } from "@lindorm-io/winston";

describe("createLogger", () => {
  test("should create logger", () => {
    expect(createLogger({ environment: Environment.TEST })).toBeInstanceOf(Logger);
  });
});
