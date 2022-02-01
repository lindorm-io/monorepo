import { Logger } from "./Logger";

describe("Logger.ts", () => {
  let instance: Logger;

  beforeEach(() => {
    instance = new Logger();
  });

  test("should create a logger instance", () => {
    expect(typeof instance.addConsole).toBe("function");
  });

  test("should be able to create a child logger with an array of context", () => {
    instance.createChildLogger(["one", "two", "three"]);
  });

  test("should be able to create a child logger with a string context", () => {
    instance.createChildLogger("string");
  });

  test("should be able to create a session logger with an object session", () => {
    instance.createSessionLogger({ id: "id" });
  });

  test("should add metadata to session", () => {
    const session = instance.createSessionLogger({ id: "1" });
    session.addSessionMetadata({ data: "two" });
  });

  test("should throw error when the context is wrong", () => {
    // @ts-ignore
    expect(() => instance.createChildLogger(12345)).toThrow(Error);
  });

  test("should throw error when the session is wrong", () => {
    // @ts-ignore
    expect(() => instance.createSessionLogger(12345)).toThrow(Error);
  });

  test("should throw error when session already exists", () => {
    const session = instance.createSessionLogger({ id: "1" });

    // @ts-ignore
    expect(() => session.createSessionLogger({ id: "2" })).toThrow(Error);
  });

  test("should throw error when session does not exist", () => {
    expect(() => instance.addSessionMetadata({ data: "two" })).toThrow(Error);
  });

  test("should add path to filter", () => {
    instance.addFilter("meta.path.text");
  });
});
