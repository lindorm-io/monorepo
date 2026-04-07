import { createMockZephyr } from "./create-mock-zephyr";

describe("createMockZephyr", () => {
  test("should create mock with all interface methods", () => {
    const mock = createMockZephyr();

    expect(mock.id).toBe("mock-id");
    expect(mock.connected).toBe(true);
    expect(mock.connect).toEqual(expect.any(Function));
    expect(mock.disconnect).toEqual(expect.any(Function));
    expect(mock.emit).toEqual(expect.any(Function));
    expect(mock.request).toEqual(expect.any(Function));
    expect(mock.on).toEqual(expect.any(Function));
    expect(mock.once).toEqual(expect.any(Function));
    expect(mock.off).toEqual(expect.any(Function));
    expect(mock.room).toEqual(expect.any(Function));
    expect(mock.onConnect).toEqual(expect.any(Function));
    expect(mock.onDisconnect).toEqual(expect.any(Function));
    expect(mock.onError).toEqual(expect.any(Function));
    expect(mock.onReconnect).toEqual(expect.any(Function));
  });

  test("should resolve connect and disconnect", async () => {
    const mock = createMockZephyr();

    await expect(mock.connect()).resolves.toBeUndefined();
    await expect(mock.disconnect()).resolves.toBeUndefined();
  });

  test("should resolve request with empty object", async () => {
    const mock = createMockZephyr();

    await expect(mock.request("test")).resolves.toEqual({});
  });

  test("should return a mock room with the given name", () => {
    const mock = createMockZephyr();
    const room = mock.room("lobby");

    expect(room.name).toBe("lobby");
    expect(room.join).toEqual(expect.any(Function));
    expect(room.leave).toEqual(expect.any(Function));
  });
});
