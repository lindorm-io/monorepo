import { createMockLogger } from "@lindorm/logger";
import { createMockProteusSource } from "@lindorm/proteus/mocks";
import { createRoomContext } from "./create-room-context";

describe("createRoomContext", () => {
  const createMockSocket = (overrides: Record<string, any> = {}) => ({
    id: "socket-123",
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    ...overrides,
  });

  const createMockIo = () => ({
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    in: jest.fn().mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([{ id: "socket-a" }, { id: "socket-b" }]),
    }),
  });

  test("should return a room context object with expected shape", () => {
    const result = createRoomContext({
      socket: createMockSocket() as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
    });

    expect(Object.keys(result).sort()).toMatchSnapshot();
    expect(typeof result.join).toBe("function");
    expect(typeof result.leave).toBe("function");
    expect(typeof result.broadcast).toBe("function");
    expect(typeof result.emit).toBe("function");
    expect(typeof result.members).toBe("function");
    expect(result.presence).toBeUndefined();
  });

  test("should call socket.join when join is invoked", async () => {
    const socket = createMockSocket();

    const ctx = createRoomContext({
      socket: socket as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
    });

    await ctx.join("my-room");

    expect(socket.join).toHaveBeenCalledWith("my-room");
  });

  test("should call socket.leave when leave is invoked", async () => {
    const socket = createMockSocket();

    const ctx = createRoomContext({
      socket: socket as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
    });

    await ctx.leave("my-room");

    expect(socket.leave).toHaveBeenCalledWith("my-room");
  });

  test("should call socket.to().emit() when broadcast is invoked", () => {
    const emitFn = jest.fn();
    const socket = createMockSocket({ to: jest.fn().mockReturnValue({ emit: emitFn }) });

    const ctx = createRoomContext({
      socket: socket as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
    });

    ctx.broadcast("my-room", "event-name", { foo: "bar" });

    expect(socket.to).toHaveBeenCalledWith("my-room");
    expect(emitFn).toHaveBeenCalledWith("event-name", { foo: "bar" });
  });

  test("should call io.to().emit() when emit is invoked", () => {
    const emitFn = jest.fn();
    const io = createMockIo();
    io.to.mockReturnValue({ emit: emitFn });

    const ctx = createRoomContext({
      socket: createMockSocket() as any,
      io: io as any,
      logger: createMockLogger(),
    });

    ctx.emit("my-room", "event-name", { foo: "bar" });

    expect(io.to).toHaveBeenCalledWith("my-room");
    expect(emitFn).toHaveBeenCalledWith("event-name", { foo: "bar" });
  });

  test("should call io.in().fetchSockets() when members is invoked", async () => {
    const io = createMockIo();

    const ctx = createRoomContext({
      socket: createMockSocket() as any,
      io: io as any,
      logger: createMockLogger(),
    });

    const result = await ctx.members("my-room");

    expect(io.in).toHaveBeenCalledWith("my-room");
    expect(result).toEqual(["socket-a", "socket-b"]);
  });

  test("should include presence function when proteusSource and presence are provided", () => {
    const proteusSource = createMockProteusSource();

    const ctx = createRoomContext({
      socket: createMockSocket() as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
      proteusSource: proteusSource as any,
      presence: true,
    });

    expect(typeof ctx.presence).toBe("function");
  });

  test("should not include presence when presence is false", () => {
    const proteusSource = createMockProteusSource();

    const ctx = createRoomContext({
      socket: createMockSocket() as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
      proteusSource: proteusSource as any,
      presence: false,
    });

    expect(ctx.presence).toBeUndefined();
  });

  test("should not include presence when proteusSource is not provided", () => {
    const ctx = createRoomContext({
      socket: createMockSocket() as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
      presence: true,
    });

    expect(ctx.presence).toBeUndefined();
  });

  test("should use socket.data.tokens.accessToken.payload.subject as userId", async () => {
    const proteusSource = createMockProteusSource();
    const mockRepo = {
      findOneOrSave: jest.fn().mockResolvedValue(undefined),
    };
    (proteusSource.session as jest.Mock).mockReturnValue({
      repository: jest.fn().mockReturnValue(mockRepo),
    });

    const socket = createMockSocket({
      data: {
        tokens: {
          accessToken: { payload: { subject: "user-abc" } },
        },
      },
    });

    const ctx = createRoomContext({
      socket: socket as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
      proteusSource: proteusSource as any,
      presence: true,
    });

    await ctx.join("room-1");

    expect(mockRepo.findOneOrSave).toHaveBeenCalledWith(
      { id: "room-1:socket-123" },
      expect.objectContaining({ userId: "user-abc" }),
    );
  });

  test("should fall back to socket.id when no accessToken subject", async () => {
    const proteusSource = createMockProteusSource();
    const mockRepo = {
      findOneOrSave: jest.fn().mockResolvedValue(undefined),
    };
    (proteusSource.session as jest.Mock).mockReturnValue({
      repository: jest.fn().mockReturnValue(mockRepo),
    });

    const socket = createMockSocket();

    const ctx = createRoomContext({
      socket: socket as any,
      io: createMockIo() as any,
      logger: createMockLogger(),
      proteusSource: proteusSource as any,
      presence: true,
    });

    await ctx.join("room-1");

    expect(mockRepo.findOneOrSave).toHaveBeenCalledWith(
      { id: "room-1:socket-123" },
      expect.objectContaining({ userId: "socket-123" }),
    );
  });
});
