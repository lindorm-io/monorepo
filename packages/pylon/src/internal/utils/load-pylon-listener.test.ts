import { composeMiddleware } from "@lindorm/middleware";
import { PylonListener } from "../../classes";
import { EventSegment } from "../classes/EventMatcher";
import { composePylonSocketContextBase } from "./compose-pylon-socket-context";
import { loadPylonListeners } from "./load-pylon-listener";

jest.mock("@lindorm/middleware");
jest.mock("./compose-pylon-socket-context", () => ({
  composePylonSocketContextBase: jest.fn().mockReturnValue({ mocked: true, params: {} }),
}));

const mockComposeMiddleware = composeMiddleware as jest.MockedFunction<
  typeof composeMiddleware
>;
const mockComposeContext = composePylonSocketContextBase as jest.MockedFunction<
  typeof composePylonSocketContextBase
>;

const literal = (value: string): EventSegment => ({ type: "literal", value });
const param = (value: string): EventSegment => ({ type: "param", value });

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

    expect(socket.on).toHaveBeenCalledWith("chat:message", expect.any(Function));
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
      { mocked: true, params: {} },
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
      { mocked: true, params: {} },
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

  describe("dynamic routing via EventMatcher", () => {
    test("should register onAny handler when dynamic segments exist", () => {
      const listener = new PylonListener();
      const handler = jest.fn();
      listener._addScannedListener(
        "rooms::roomId:join",
        "on",
        [literal("rooms"), param("roomId"), literal("join")],
        [handler],
      );

      loadPylonListeners(io, socket, [], [listener]);

      // Should not register via socket.on (dynamic)
      expect(socket.on).not.toHaveBeenCalled();
      // Should register onAny for trie matching
      expect(socket.onAny).toHaveBeenCalledWith(expect.any(Function));
    });

    test("should dispatch dynamic event and set params on context", async () => {
      const handler = jest.fn();
      const listener = new PylonListener();
      listener._addScannedListener(
        "rooms::roomId:join",
        "on",
        [literal("rooms"), param("roomId"), literal("join")],
        [handler],
      );

      const ctx = { mocked: true, params: {} } as any;
      mockComposeContext.mockReturnValue(ctx);

      loadPylonListeners(io, socket, [], [listener]);

      const onAnyHandler = socket.onAny.mock.calls[0][0];
      await onAnyHandler("rooms:lobby:join", "arg1");

      expect(ctx.params).toEqual({ roomId: "lobby" });
      expect(mockComposeMiddleware).toHaveBeenCalledWith(
        ctx,
        expect.arrayContaining([handler]),
        { useClone: false },
      );
    });

    test("should not dispatch when dynamic event does not match trie", async () => {
      const handler = jest.fn();
      const listener = new PylonListener();
      listener._addScannedListener(
        "rooms::roomId:join",
        "on",
        [literal("rooms"), param("roomId"), literal("join")],
        [handler],
      );

      loadPylonListeners(io, socket, [], [listener]);

      const onAnyHandler = socket.onAny.mock.calls[0][0];
      await onAnyHandler("chat:message", "arg1");

      expect(mockComposeMiddleware).not.toHaveBeenCalled();
    });

    test("should fire once handler only on first match", async () => {
      const handler = jest.fn();
      const listener = new PylonListener();
      listener._addScannedListener(
        "rooms::roomId:leave",
        "once",
        [literal("rooms"), param("roomId"), literal("leave")],
        [handler],
      );

      const ctx = { mocked: true, params: {} } as any;
      mockComposeContext.mockReturnValue(ctx);

      loadPylonListeners(io, socket, [], [listener]);

      const onAnyHandler = socket.onAny.mock.calls[0][0];

      await onAnyHandler("rooms:lobby:leave", "arg1");
      expect(mockComposeMiddleware).toHaveBeenCalledTimes(1);

      await onAnyHandler("rooms:lobby:leave", "arg2");
      expect(mockComposeMiddleware).toHaveBeenCalledTimes(1);
    });

    test("should prepend prefix segments for dynamic routes", async () => {
      const handler = jest.fn();
      const listener = new PylonListener({ prefix: "game" });
      listener._addScannedListener(
        "rooms::roomId:join",
        "on",
        [literal("rooms"), param("roomId"), literal("join")],
        [handler],
      );

      const ctx = { mocked: true, params: {} } as any;
      mockComposeContext.mockReturnValue(ctx);

      loadPylonListeners(io, socket, [], [listener]);

      const onAnyHandler = socket.onAny.mock.calls[0][0];
      await onAnyHandler("game:rooms:lobby:join", "arg1");

      expect(ctx.params).toEqual({ roomId: "lobby" });
      expect(mockComposeMiddleware).toHaveBeenCalledTimes(1);
    });

    test("should include global and listener middleware for dynamic routes", async () => {
      const globalMw = jest.fn();
      const listenerMw = jest.fn();
      const handler = jest.fn();

      const listener = new PylonListener();
      listener.use(listenerMw);
      listener._addScannedListener(
        "rooms::roomId:join",
        "on",
        [literal("rooms"), param("roomId"), literal("join")],
        [handler],
      );

      const ctx = { mocked: true, params: {} } as any;
      mockComposeContext.mockReturnValue(ctx);

      loadPylonListeners(io, socket, [globalMw], [listener]);

      const onAnyHandler = socket.onAny.mock.calls[0][0];
      await onAnyHandler("rooms:lobby:join", "arg1");

      expect(mockComposeMiddleware).toHaveBeenCalledWith(
        ctx,
        [globalMw, listenerMw, handler],
        { useClone: false },
      );
    });

    test("should register static listeners directly even when dynamic ones exist", () => {
      const staticHandler = jest.fn();
      const dynamicHandler = jest.fn();

      const staticListener = new PylonListener();
      staticListener.on("chat:message", staticHandler);

      const dynamicListener = new PylonListener();
      dynamicListener._addScannedListener(
        "rooms::roomId:join",
        "on",
        [literal("rooms"), param("roomId"), literal("join")],
        [dynamicHandler],
      );

      loadPylonListeners(io, socket, [], [staticListener, dynamicListener]);

      // Static registered directly
      expect(socket.on).toHaveBeenCalledWith("chat:message", expect.any(Function));
      // Dynamic registered via onAny
      expect(socket.onAny).toHaveBeenCalledWith(expect.any(Function));
    });

    test("should not register onAny when all listeners are static", () => {
      const listener = new PylonListener();
      listener._addScannedListener(
        "chat:message",
        "on",
        [literal("chat"), literal("message")],
        [jest.fn()],
      );

      loadPylonListeners(io, socket, [], [listener]);

      expect(socket.on).toHaveBeenCalledWith("chat:message", expect.any(Function));
      expect(socket.onAny).not.toHaveBeenCalled();
    });
  });
});
