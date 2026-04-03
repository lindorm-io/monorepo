import { composeMiddleware } from "@lindorm/middleware";
import { PylonListener } from "../../classes";
import { loadPylonListeners } from "./load-pylon-listener";

jest.mock("@lindorm/middleware");
jest.mock("./compose-pylon-socket-context", () => ({
  composePylonSocketContextBase: jest.fn().mockReturnValue({ mocked: true }),
}));

const mockComposeMiddleware = composeMiddleware as jest.MockedFunction<
  typeof composeMiddleware
>;

describe("loadPylonListeners", () => {
  let io: any;
  let socket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockComposeMiddleware.mockResolvedValue(undefined as any);

    io = {};
    socket = {
      on: jest.fn(),
      once: jest.fn(),
      onAny: jest.fn(),
      onAnyOutgoing: jest.fn(),
      prependAny: jest.fn(),
      prependAnyOutgoing: jest.fn(),
    };
  });

  test("should register 'on' listeners on the socket", () => {
    const listener = new PylonListener();
    listener.on("test-event", jest.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.on).toHaveBeenCalledWith("test-event", expect.any(Function));
  });

  test("should register 'once' listeners on the socket", () => {
    const listener = new PylonListener();
    listener.once("disconnect", jest.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.once).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });

  test("should register 'onAny' listeners on the socket", () => {
    const listener = new PylonListener();
    listener.onAny("any-event", jest.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.onAny).toHaveBeenCalledWith(expect.any(Function));
  });

  test("should prepend prefix to event name", () => {
    const listener = new PylonListener({ prefix: "chat" });
    listener.on("message", jest.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.on).toHaveBeenCalledWith("chat/message", expect.any(Function));
  });

  test("should not prepend prefix when listener has no prefix", () => {
    const listener = new PylonListener();
    listener.on("message", jest.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.on).toHaveBeenCalledWith("message", expect.any(Function));
  });

  test("should compose middleware when on-handler is invoked", async () => {
    const listener = new PylonListener();
    const handler = jest.fn();
    listener.on("test-event", handler);

    const globalMiddleware = [jest.fn()];

    loadPylonListeners(io, socket, globalMiddleware, [listener]);

    const registeredHandler = socket.on.mock.calls[0][1];
    await registeredHandler("arg1", "arg2");

    expect(mockComposeMiddleware).toHaveBeenCalledWith(
      { mocked: true },
      expect.arrayContaining([globalMiddleware[0], handler]),
      { useClone: false },
    );
  });

  test("should compose middleware when onAny-handler is invoked", async () => {
    const listener = new PylonListener();
    const handler = jest.fn();
    listener.onAny("any-event", handler);

    loadPylonListeners(io, socket, [], [listener]);

    const registeredHandler = socket.onAny.mock.calls[0][0];
    await registeredHandler("dynamic-event", "arg1");

    expect(mockComposeMiddleware).toHaveBeenCalledWith(
      { mocked: true },
      expect.arrayContaining([handler]),
      { useClone: false },
    );
  });

  test("should handle multiple listeners", () => {
    const listener1 = new PylonListener();
    listener1.on("event1", jest.fn());

    const listener2 = new PylonListener();
    listener2.on("event2", jest.fn());
    listener2.once("event3", jest.fn());

    loadPylonListeners(io, socket, [], [listener1, listener2]);

    expect(socket.on).toHaveBeenCalledTimes(2);
    expect(socket.once).toHaveBeenCalledTimes(1);
  });
});
