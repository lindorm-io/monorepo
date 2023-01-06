import { WinstonLogger } from "./WinstonLogger";

describe("WinstonLogger", () => {
  let logger: WinstonLogger;

  beforeEach(() => {
    logger = new WinstonLogger();
    logger.addConsole("silly");
  });

  test("should create a logger instance", () => {
    expect(logger.addConsole).toBeInstanceOf(Function);
  });

  test("should be able to create a child logger with an array of context", () => {
    expect(() => logger.createChildLogger(["one", "two", "three"])).not.toThrow();
  });

  test("should be able to create a child logger with a context string", () => {
    expect(() => logger.createChildLogger("five")).not.toThrow();
  });

  test("should be able to create a session logger with an object session", () => {
    expect(() => logger.createSessionLogger({ id: "id" })).not.toThrow();
  });

  test("should throw error when the context is wrong", () => {
    // @ts-ignore
    expect(() => logger.createChildLogger(true)).toThrow(Error);
  });

  test("should throw error when the session is wrong", () => {
    // @ts-ignore
    expect(() => logger.createSessionLogger(12345)).toThrow(Error);
  });
});
