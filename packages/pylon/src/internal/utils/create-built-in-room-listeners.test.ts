import { PylonListener } from "../../classes";
import { createBuiltInRoomListeners } from "./create-built-in-room-listeners";
import { describe, expect, it, vi } from "vitest";

describe("createBuiltInRoomListeners", () => {
  it("should return an array with one PylonListener", () => {
    const result = createBuiltInRoomListeners();

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(PylonListener);
  });

  it("should have two listener entries (join and leave)", () => {
    const [listener] = createBuiltInRoomListeners();

    expect(listener.listeners).toHaveLength(2);
  });

  it("should have correct segments for join", () => {
    const [listener] = createBuiltInRoomListeners();
    const join = listener.listeners[0];

    expect(join.event).toBe("rooms::roomId:join");
    expect(join.method).toBe("on");
    expect(join.segments).toMatchSnapshot();
  });

  it("should have correct segments for leave", () => {
    const [listener] = createBuiltInRoomListeners();
    const leave = listener.listeners[1];

    expect(leave.event).toBe("rooms::roomId:leave");
    expect(leave.method).toBe("on");
    expect(leave.segments).toMatchSnapshot();
  });

  describe("join handler", () => {
    const createCtx = (overrides: Record<string, any> = {}) => ({
      params: { roomId: "test-room" },
      rooms: {
        join: vi.fn().mockResolvedValue(undefined),
        leave: vi.fn().mockResolvedValue(undefined),
      },
      ack: vi.fn(),
      nack: vi.fn(),
      ...overrides,
    });

    it("should call ctx.rooms.join with roomId from params", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[0].listeners[0];
      const ctx = createCtx();

      await handler(ctx as any, vi.fn());

      expect(ctx.rooms.join).toHaveBeenCalledWith("test-room");
    });

    it("should call ctx.ack on success", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[0].listeners[0];
      const ctx = createCtx();

      await handler(ctx as any, vi.fn());

      expect(ctx.ack).toHaveBeenCalledWith({ room: "test-room" });
    });

    it("should call ctx.nack on error", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[0].listeners[0];
      const ctx = createCtx({
        rooms: {
          join: vi.fn().mockRejectedValue(new Error("join failed")),
          leave: vi.fn(),
        },
      });

      await handler(ctx as any, vi.fn());

      expect(ctx.nack).toHaveBeenCalledWith({
        code: "room_join_failed",
        message: "join failed",
      });
    });

    it("should pass non-Error values to nack unchanged", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[0].listeners[0];
      const ctx = createCtx({
        rooms: {
          join: vi.fn().mockRejectedValue("string-error"),
          leave: vi.fn(),
        },
      });

      await handler(ctx as any, vi.fn());

      expect(ctx.nack).toHaveBeenCalledWith("string-error");
    });
  });

  describe("leave handler", () => {
    const createCtx = (overrides: Record<string, any> = {}) => ({
      params: { roomId: "test-room" },
      rooms: {
        join: vi.fn().mockResolvedValue(undefined),
        leave: vi.fn().mockResolvedValue(undefined),
      },
      ack: vi.fn(),
      nack: vi.fn(),
      ...overrides,
    });

    it("should call ctx.rooms.leave with roomId from params", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[1].listeners[0];
      const ctx = createCtx();

      await handler(ctx as any, vi.fn());

      expect(ctx.rooms.leave).toHaveBeenCalledWith("test-room");
    });

    it("should call ctx.ack on success", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[1].listeners[0];
      const ctx = createCtx();

      await handler(ctx as any, vi.fn());

      expect(ctx.ack).toHaveBeenCalledWith({ room: "test-room" });
    });

    it("should call ctx.nack on error", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[1].listeners[0];
      const ctx = createCtx({
        rooms: {
          join: vi.fn(),
          leave: vi.fn().mockRejectedValue(new Error("leave failed")),
        },
      });

      await handler(ctx as any, vi.fn());

      expect(ctx.nack).toHaveBeenCalledWith({
        code: "room_leave_failed",
        message: "leave failed",
      });
    });

    it("should pass non-Error values to nack unchanged", async () => {
      const [listener] = createBuiltInRoomListeners();
      const handler = listener.listeners[1].listeners[0];
      const ctx = createCtx({
        rooms: {
          join: vi.fn(),
          leave: vi.fn().mockRejectedValue({ custom: "error" }),
        },
      });

      await handler(ctx as any, vi.fn());

      expect(ctx.nack).toHaveBeenCalledWith({ custom: "error" });
    });
  });
});
