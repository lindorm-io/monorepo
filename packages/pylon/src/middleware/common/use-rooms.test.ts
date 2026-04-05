import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { ROOMS_SOURCE } from "#internal/constants/symbols";
import { useRooms } from "./use-rooms";

jest.mock("#internal/utils/is-context");

import { isSocketContext } from "#internal/utils/is-context";

describe("useRooms", () => {
  let ctx: any;
  let next: jest.Mock;
  let mockRepository: any;
  let mockSource: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      findOneOrSave: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue({ id: "room-1:socket-123" }),
      find: jest.fn().mockResolvedValue([
        { userId: "user-1", socketId: "s1", joinedAt: new Date("2026-01-01T00:00:00Z") },
        { userId: "user-2", socketId: "s2", joinedAt: new Date("2026-01-01T00:01:00Z") },
      ]),
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    const sessionSource = { repository: jest.fn().mockReturnValue(mockRepository) };
    mockSource = { session: jest.fn().mockReturnValue(sessionSource) };
    (isSocketContext as unknown as jest.Mock).mockReturnValue(true);

    ctx = {
      logger: createMockLogger(),
      socket: {
        id: "socket-123",
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      },
      io: {
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
        in: jest.fn().mockReturnValue({
          fetchSockets: jest.fn().mockResolvedValue([{ id: "s1" }, { id: "s2" }]),
        }),
      },
      state: { tokens: {} },
      [ROOMS_SOURCE]: mockSource,
    };

    next = jest.fn();
  });

  test("should add ctx.rooms on socket context", async () => {
    await useRooms()(ctx, next);

    expect(ctx.rooms).toBeDefined();
    expect(ctx.rooms.join).toEqual(expect.any(Function));
    expect(ctx.rooms.leave).toEqual(expect.any(Function));
    expect(ctx.rooms.broadcast).toEqual(expect.any(Function));
    expect(ctx.rooms.emit).toEqual(expect.any(Function));
    expect(ctx.rooms.members).toEqual(expect.any(Function));
  });

  test("should throw ServerError on non-socket context", async () => {
    (isSocketContext as unknown as jest.Mock).mockReturnValue(false);

    await expect(useRooms()(ctx, next)).rejects.toThrow(ServerError);
    expect(next).not.toHaveBeenCalled();
  });

  test("should call socket.join when ctx.rooms.join is called", async () => {
    await useRooms()(ctx, next);
    await ctx.rooms.join("lobby");

    expect(ctx.socket.join).toHaveBeenCalledWith("lobby");
  });

  test("should call socket.leave when ctx.rooms.leave is called", async () => {
    await useRooms()(ctx, next);
    await ctx.rooms.leave("lobby");

    expect(ctx.socket.leave).toHaveBeenCalledWith("lobby");
  });

  test("should call socket.to(room).emit for broadcast", async () => {
    await useRooms()(ctx, next);
    ctx.rooms.broadcast("lobby", "message", { text: "hello" });

    expect(ctx.socket.to).toHaveBeenCalledWith("lobby");
    expect(ctx.socket.to("lobby").emit).toHaveBeenCalledWith("message", {
      text: "hello",
    });
  });

  test("should call io.to(room).emit for emit", async () => {
    await useRooms()(ctx, next);
    ctx.rooms.emit("lobby", "message", { text: "hello" });

    expect(ctx.io.to).toHaveBeenCalledWith("lobby");
    expect(ctx.io.to("lobby").emit).toHaveBeenCalledWith("message", { text: "hello" });
  });

  test("should return socket IDs from fetchSockets for members", async () => {
    await useRooms()(ctx, next);
    const result = await ctx.rooms.members("lobby");

    expect(ctx.io.in).toHaveBeenCalledWith("lobby");
    expect(result).toEqual(["s1", "s2"]);
  });

  test("should create presence record on join when presence enabled", async () => {
    await useRooms({ presence: true })(ctx, next);
    await ctx.rooms.join("lobby");

    expect(mockRepository.findOneOrSave).toHaveBeenCalledWith(
      { id: "lobby:socket-123" },
      expect.objectContaining({
        id: "lobby:socket-123",
        room: "lobby",
        socketId: "socket-123",
        userId: "socket-123",
        joinedAt: expect.any(Date),
        expiresAt: expect.any(Date),
      }),
    );
  });

  test("should destroy presence record on leave when presence enabled", async () => {
    await useRooms({ presence: true })(ctx, next);
    await ctx.rooms.leave("lobby");

    expect(mockRepository.findOne).toHaveBeenCalledWith({ id: "lobby:socket-123" });
    expect(mockRepository.destroy).toHaveBeenCalledWith({ id: "room-1:socket-123" });
  });

  test("should return presence records for room when presence enabled", async () => {
    await useRooms({ presence: true })(ctx, next);
    const result = await ctx.rooms.presence!("lobby");

    expect(mockRepository.find).toHaveBeenCalledWith({ room: "lobby" });
    expect(result).toEqual([
      { userId: "user-1", socketId: "s1", joinedAt: new Date("2026-01-01T00:00:00Z") },
      { userId: "user-2", socketId: "s2", joinedAt: new Date("2026-01-01T00:01:00Z") },
    ]);
  });

  test("should not have presence method when presence disabled", async () => {
    await useRooms()(ctx, next);

    expect(ctx.rooms.presence).toBeUndefined();
  });

  test("should call next", async () => {
    await useRooms()(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should use userId from access token when available", async () => {
    ctx.state.tokens.accessToken = { payload: { subject: "user-abc" } };

    await useRooms({ presence: true })(ctx, next);
    await ctx.rooms.join("lobby");

    expect(mockRepository.findOneOrSave).toHaveBeenCalledWith(
      { id: "lobby:socket-123" },
      expect.objectContaining({ userId: "user-abc" }),
    );
  });

  test("should not create presence record on join when presence disabled", async () => {
    await useRooms()(ctx, next);
    await ctx.rooms.join("lobby");

    expect(mockSource.session).not.toHaveBeenCalled();
    expect(mockRepository.findOneOrSave).not.toHaveBeenCalled();
  });

  test("should not destroy presence record on leave when presence disabled", async () => {
    await useRooms()(ctx, next);
    await ctx.rooms.leave("lobby");

    expect(mockRepository.findOne).not.toHaveBeenCalled();
    expect(mockRepository.destroy).not.toHaveBeenCalled();
  });

  test("should handle leave when no presence record exists", async () => {
    mockRepository.findOne.mockResolvedValue(null);

    await useRooms({ presence: true })(ctx, next);
    await ctx.rooms.leave("lobby");

    expect(mockRepository.findOne).toHaveBeenCalledWith({ id: "lobby:socket-123" });
    expect(mockRepository.destroy).not.toHaveBeenCalled();
  });

  test("should throw ServerError when rooms source is missing with presence enabled", async () => {
    delete ctx[ROOMS_SOURCE];

    await expect(useRooms({ presence: true })(ctx, next)).rejects.toThrow(ServerError);
    expect(next).not.toHaveBeenCalled();
  });

  test("should work without rooms source when presence is disabled", async () => {
    delete ctx[ROOMS_SOURCE];

    await useRooms()(ctx, next);

    expect(ctx.rooms).toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
