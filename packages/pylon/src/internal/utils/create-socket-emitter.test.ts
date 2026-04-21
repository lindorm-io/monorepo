import { createHttpSocketEmitter, createSocketEmitter } from "./create-socket-emitter.js";
import { describe, expect, test, vi } from "vitest";

describe("createHttpSocketEmitter", () => {
  const createMockIo = () => {
    const emitFn = vi.fn();
    return {
      io: { to: vi.fn().mockReturnValue({ emit: emitFn }) } as any,
      emitFn,
    };
  };

  test("should return an object with emit method", () => {
    const { io } = createMockIo();
    const emitter = createHttpSocketEmitter({ io, correlationId: "corr-1" });

    expect(typeof emitter.emit).toBe("function");
    expect(Object.keys(emitter)).toMatchSnapshot();
  });

  test("should call io.to().emit() with envelope when emit is invoked", () => {
    const { io, emitFn } = createMockIo();
    const emitter = createHttpSocketEmitter({ io, correlationId: "corr-1" });

    emitter.emit("room-1", "my-event", { foo: "bar" });

    expect(io.to).toHaveBeenCalledWith("room-1");
    expect(emitFn).toHaveBeenCalledWith("my-event", {
      __pylon: true,
      header: { correlationId: "corr-1" },
      payload: { foo: "bar" },
    });
  });

  test("should wrap undefined data in envelope", () => {
    const { io, emitFn } = createMockIo();
    const emitter = createHttpSocketEmitter({ io, correlationId: "corr-2" });

    emitter.emit("room-1", "my-event");

    expect(emitFn).toHaveBeenCalledWith("my-event", {
      __pylon: true,
      header: { correlationId: "corr-2" },
      payload: undefined,
    });
  });
});

describe("createSocketEmitter", () => {
  const createMockIo = () => {
    const emitFn = vi.fn();
    return {
      io: { to: vi.fn().mockReturnValue({ emit: emitFn }) } as any,
      emitFn,
    };
  };

  const createMockSocket = () => {
    const emitFn = vi.fn();
    return {
      socket: { to: vi.fn().mockReturnValue({ emit: emitFn }) } as any,
      emitFn,
    };
  };

  test("should return an object with emit and broadcast methods", () => {
    const { io } = createMockIo();
    const { socket } = createMockSocket();
    const emitter = createSocketEmitter({ io, socket, correlationId: "corr-1" });

    expect(typeof emitter.emit).toBe("function");
    expect(typeof emitter.broadcast).toBe("function");
    expect(Object.keys(emitter).sort()).toMatchSnapshot();
  });

  test("should call io.to().emit() with envelope when emit is invoked", () => {
    const { io, emitFn } = createMockIo();
    const { socket } = createMockSocket();
    const emitter = createSocketEmitter({ io, socket, correlationId: "corr-1" });

    emitter.emit("room-1", "my-event", { foo: "bar" });

    expect(io.to).toHaveBeenCalledWith("room-1");
    expect(emitFn).toHaveBeenCalledWith("my-event", {
      __pylon: true,
      header: { correlationId: "corr-1" },
      payload: { foo: "bar" },
    });
  });

  test("should call socket.to().emit() with envelope when broadcast is invoked", () => {
    const { io } = createMockIo();
    const { socket, emitFn } = createMockSocket();
    const emitter = createSocketEmitter({ io, socket, correlationId: "corr-1" });

    emitter.broadcast("room-1", "my-event", { data: 42 });

    expect(socket.to).toHaveBeenCalledWith("room-1");
    expect(emitFn).toHaveBeenCalledWith("my-event", {
      __pylon: true,
      header: { correlationId: "corr-1" },
      payload: { data: 42 },
    });
  });

  test("should wrap undefined data in envelope for broadcast", () => {
    const { io } = createMockIo();
    const { socket, emitFn } = createMockSocket();
    const emitter = createSocketEmitter({ io, socket, correlationId: "corr-3" });

    emitter.broadcast("room-1", "my-event");

    expect(emitFn).toHaveBeenCalledWith("my-event", {
      __pylon: true,
      header: { correlationId: "corr-3" },
      payload: undefined,
    });
  });
});
