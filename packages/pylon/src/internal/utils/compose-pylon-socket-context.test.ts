import { composePylonSocketContextBase } from "./compose-pylon-socket-context";

// randomUUID is called internally; mock it for deterministic snapshots
jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: () => "00000000-0000-0000-0000-000000000000",
}));

describe("composePylonSocketContextBase", () => {
  const io: any = { fake: "io" };
  const socket: any = { fake: "socket" };

  test("should compose context with a single object arg (camelCased)", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: [{ "some-key": "value", "another-key": 42 }],
      event: "test:event",
    });

    expect(result).toMatchSnapshot();
  });

  test("should pass args through when multiple args are provided", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: ["arg1", "arg2", "arg3"],
      event: "multi:args",
    });

    expect(result).toMatchSnapshot();
  });

  test("should pass args through when single arg is not an object", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: ["string-arg"],
      event: "string:event",
    });

    expect(result).toMatchSnapshot();
  });

  test("should pass args through when single arg is an array", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: [[1, 2, 3]],
      event: "array:event",
    });

    expect(result).toMatchSnapshot();
  });

  test("should handle empty args array", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: [],
      event: "empty:event",
    });

    expect(result).toMatchSnapshot();
  });

  test("should set data equal to args", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: [{ key: "value" }],
      event: "test:data",
    });

    expect(result.data).toBe(result.args);
  });

  test("should include io and socket references", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: [],
      event: "ref:test",
    });

    expect(result.io).toBe(io);
    expect(result.socket).toBe(socket);
  });

  test("should set params to empty object", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: [],
      event: "params:test",
    });

    expect(result.params).toEqual({});
  });

  test("should set ack and nack to null when no callback provided", () => {
    const result = composePylonSocketContextBase(io, socket, {
      args: [{ key: "value" }],
      event: "no:ack",
    });

    expect(result.ack).toBeNull();
    expect(result.nack).toBeNull();
  });

  test("should extract ack callback from last arg when it is a function", () => {
    const callback = jest.fn();
    const result = composePylonSocketContextBase(io, socket, {
      args: [{ key: "value" }, callback],
      event: "with:ack",
    });

    expect(result.ack).toBeInstanceOf(Function);
    expect(result.nack).toBeInstanceOf(Function);
    expect(result.data).toEqual({ key: "value" });
  });

  test("should call rawAck with envelope { ok: true, data } when ack is called", () => {
    const callback = jest.fn();
    const result = composePylonSocketContextBase(io, socket, {
      args: [{ key: "value" }, callback],
      event: "ack:test",
    });

    result.ack!({ success: true });

    expect(callback).toHaveBeenCalledWith({ ok: true, data: { success: true } });
  });

  test("should call rawAck with envelope { ok: false, error } when nack is called", () => {
    const callback = jest.fn();
    const result = composePylonSocketContextBase(io, socket, {
      args: [{ key: "value" }, callback],
      event: "nack:test",
    });

    result.nack!({ code: "not_found", message: "User not found" });

    expect(callback).toHaveBeenCalledWith({
      ok: false,
      error: { code: "not_found", message: "User not found" },
    });
  });

  test("should not include ack callback in args", () => {
    const callback = jest.fn();
    const result = composePylonSocketContextBase(io, socket, {
      args: ["arg1", "arg2", callback],
      event: "strip:ack",
    });

    expect(result.args).toEqual(["arg1", "arg2"]);
    expect(result.ack).toBeInstanceOf(Function);
  });
});
