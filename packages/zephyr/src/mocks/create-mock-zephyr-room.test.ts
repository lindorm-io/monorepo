import { createMockZephyrRoom } from "./vitest";
import { describe, expect, test } from "vitest";

describe("createMockZephyrRoom", () => {
  test("should create mock with default name", () => {
    const mock = createMockZephyrRoom();

    expect(mock.name).toBe("mock-room");
  });

  test("should create mock with custom name", () => {
    const mock = createMockZephyrRoom("lobby");

    expect(mock.name).toBe("lobby");
  });

  test("should have all interface methods", () => {
    const mock = createMockZephyrRoom();

    expect(mock.join).toEqual(expect.any(Function));
    expect(mock.leave).toEqual(expect.any(Function));
    expect(mock.emit).toEqual(expect.any(Function));
    expect(mock.on).toEqual(expect.any(Function));
    expect(mock.off).toEqual(expect.any(Function));
  });

  test("should resolve join and leave", async () => {
    const mock = createMockZephyrRoom();

    await expect(mock.join()).resolves.toBeUndefined();
    await expect(mock.leave()).resolves.toBeUndefined();
  });
});
