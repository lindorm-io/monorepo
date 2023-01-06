import { WinstonLogger, LogLevel } from "@lindorm-io/winston";
import { createLogger } from "./create-logger";

describe("createLogger", () => {
  test("should create logger", () => {
    expect(createLogger()).toBeInstanceOf(WinstonLogger);
  });

  test("should create logger with specific level", () => {
    expect(createLogger({ level: LogLevel.SILLY })).toBeInstanceOf(WinstonLogger);
  });

  test("should throw", () => {
    const level: any = "wrong";

    expect(() => createLogger({ level })).toThrow(Error);
  });
});
