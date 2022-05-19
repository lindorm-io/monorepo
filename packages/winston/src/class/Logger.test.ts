import { Logger } from "./Logger";

let winstonLog = jest.fn();

jest.mock("winston", () => ({
  createLogger: jest.fn(() => ({
    log: winstonLog,
  })),
}));

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

  test("should be able to create a session logger with an object session", () => {
    instance.createSessionLogger({ id: "id" });
  });

  test("should add metadata to session", () => {
    const session = instance.createSessionLogger({ id: "1" });
    session.addSession({ data: "two" });
  });

  test("should throw error when the context is wrong", () => {
    // @ts-ignore
    expect(() => instance.createChildLogger(12345)).toThrow(Error);
  });

  test("should throw error when the session is wrong", () => {
    // @ts-ignore
    expect(() => instance.createSessionLogger(12345)).toThrow(Error);
  });

  test("should add filter", () => {
    instance.addFilter("filtered.path.message");
    instance.silly("message", {
      mock: "details",
      filtered: { path: { message: "message" } },
    });

    expect(winstonLog).toHaveBeenCalledWith({
      context: [],
      details: {
        filtered: {
          path: {
            message: "[Filtered]",
          },
        },
        mock: "details",
      },
      level: "silly",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });
});
