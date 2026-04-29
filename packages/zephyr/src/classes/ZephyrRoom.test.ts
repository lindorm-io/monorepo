import { ZephyrRoom } from "./ZephyrRoom.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("ZephyrRoom", () => {
  let mockZephyr: any;
  let room: ZephyrRoom;

  beforeEach(() => {
    mockZephyr = {
      emit: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
    };

    room = new ZephyrRoom(mockZephyr, "lobby");
  });

  test("should expose room name", () => {
    expect(room.name).toBe("lobby");
  });

  test("should join via request", async () => {
    await room.join();

    expect(mockZephyr.request).toHaveBeenCalledWith("rooms:lobby:join");
  });

  test("should leave via request", async () => {
    await room.leave();

    expect(mockZephyr.request).toHaveBeenCalledWith("rooms:lobby:leave");
  });

  test("should emit with room-scoped event", async () => {
    await room.emit("message", { text: "hello" });

    expect(mockZephyr.emit).toHaveBeenCalledWith("rooms:lobby:message", {
      text: "hello",
    });
  });

  test("should register on handler with room-scoped event", () => {
    const handler = vi.fn();

    room.on("message", handler);

    expect(mockZephyr.on).toHaveBeenCalledWith("rooms:lobby:message", handler);
  });

  test("should remove handler with room-scoped event", () => {
    const handler = vi.fn();

    room.off("message", handler);

    expect(mockZephyr.off).toHaveBeenCalledWith("rooms:lobby:message", handler);
  });

  test("should remove all handlers when no handler given", () => {
    room.off("message");

    expect(mockZephyr.off).toHaveBeenCalledWith("rooms:lobby:message", undefined);
  });
});
