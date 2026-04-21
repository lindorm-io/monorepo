import { composeMiddleware } from "@lindorm/middleware";
import { PylonListener } from "../../classes/index.js";
import type { EventSegment } from "../classes/EventMatcher.js";
import { composePylonSocketContextBase } from "./compose-pylon-socket-context.js";
import { loadPylonListeners } from "./load-pylon-listener.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("@lindorm/middleware");
vi.mock("./compose-pylon-socket-context.js", async () => ({
  composePylonSocketContextBase: vi.fn().mockReturnValue({ mocked: true, params: {} }),
}));

const mockComposeMiddleware = composeMiddleware as MockedFunction<
  typeof composeMiddleware
>;
const mockComposeContext = composePylonSocketContextBase as MockedFunction<
  typeof composePylonSocketContextBase
>;

const literal = (value: string): EventSegment => ({ type: "literal", value });
const param = (value: string): EventSegment => ({ type: "param", value });

describe("loadPylonListeners", () => {
  let io: any;
  let socket: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockComposeMiddleware.mockResolvedValue(undefined as any);

    io = {};
    socket = {
      on: vi.fn(),
      once: vi.fn(),
      onAny: vi.fn(),
      onAnyOutgoing: vi.fn(),
      prependAny: vi.fn(),
      prependAnyOutgoing: vi.fn(),
    };
  });

  test("should register 'on' listeners on the socket", () => {
    const listener = new PylonListener();
    listener.on("test-event", vi.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.on).toHaveBeenCalledWith("test-event", expect.any(Function));
  });

  test("should register 'once' listeners on the socket", () => {
    const listener = new PylonListener();
    listener.once("disconnect", vi.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.once).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });

  test("should register 'onAny' listeners on the socket", () => {
    const listener = new PylonListener();
    listener.onAny("any-event", vi.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.onAny).toHaveBeenCalledWith(expect.any(Function));
  });

  test("should prepend prefix to event name", () => {
    const listener = new PylonListener({ prefix: "chat" });
    listener.on("message", vi.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.on).toHaveBeenCalledWith("chat:message", expect.any(Function));
  });

  test("should not prepend prefix when listener has no prefix", () => {
    const listener = new PylonListener();
    listener.on("message", vi.fn());

    loadPylonListeners(io, socket, [], [listener]);

    expect(socket.on).toHaveBeenCalledWith("message", expect.any(Function));
  });

  test("should compose middleware when on-handler is invoked", async () => {
    const listener = new PylonListener();
    const handler = vi.fn();
    listener.on("test-event", handler);

    const globalMiddleware = [vi.fn()];

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
    const handler = vi.fn();
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
    listener1.on("event1", vi.fn());

    const listener2 = new PylonListener();
    listener2.on("event2", vi.fn());
    listener2.once("event3", vi.fn());

    loadPylonListeners(io, socket, [], [listener1, listener2]);

    expect(socket.on).toHaveBeenCalledTimes(2);
    expect(socket.once).toHaveBeenCalledTimes(1);
  });

  describe("dynamic routing via EventMatcher", () => {
    test("should register onAny handler when dynamic segments exist", () => {
      const listener = new PylonListener();
      const handler = vi.fn();
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
      const handler = vi.fn();
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
      const handler = vi.fn();
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
      const handler = vi.fn();
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
      const handler = vi.fn();
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
      const globalMw = vi.fn();
      const listenerMw = vi.fn();
      const handler = vi.fn();

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
      const staticHandler = vi.fn();
      const dynamicHandler = vi.fn();

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
        [vi.fn()],
      );

      loadPylonListeners(io, socket, [], [listener]);

      expect(socket.on).toHaveBeenCalledWith("chat:message", expect.any(Function));
      expect(socket.onAny).not.toHaveBeenCalled();
    });
  });
});
