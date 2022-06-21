import { Logger, LogLevel } from "@lindorm-io/winston";
import { createLogger } from "./create-logger";

describe("createLogger", () => {
  test("should create logger", () => {
    expect(createLogger()).toBeInstanceOf(Logger);
  });

  test("should create logger with specific level", () => {
    expect(createLogger({ level: LogLevel.SILLY })).toBeInstanceOf(Logger);
  });

  test("should throw", () => {
    const level: any = "wrong";

    expect(() => createLogger({ level })).toThrow(Error);
  });
});
