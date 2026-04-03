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
});
