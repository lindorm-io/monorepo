import { createMockIrisSource } from "./vitest";
import { describe, expect, it, vi } from "vitest";

describe("createMockIrisSource", () => {
  it("should create a mock with default values", () => {
    const mock = createMockIrisSource();

    expect(mock.driver).toBe("memory");
    expect(mock.messages).toEqual([]);
  });

  it("should have all methods as vi.fn()", () => {
    const mock = createMockIrisSource();

    expect(vi.isMockFunction(mock.addMessages)).toBe(true);
    expect(vi.isMockFunction(mock.hasMessage)).toBe(true);
    expect(vi.isMockFunction(mock.addSubscriber)).toBe(true);
    expect(vi.isMockFunction(mock.removeSubscriber)).toBe(true);
    expect(vi.isMockFunction(mock.session)).toBe(true);

    expect(vi.isMockFunction(mock.connect)).toBe(true);
    expect(vi.isMockFunction(mock.disconnect)).toBe(true);
    expect(vi.isMockFunction(mock.drain)).toBe(true);
    expect(vi.isMockFunction(mock.ping)).toBe(true);
    expect(vi.isMockFunction(mock.setup)).toBe(true);
    expect(vi.isMockFunction(mock.getConnectionState)).toBe(true);
    expect(vi.isMockFunction(mock.on)).toBe(true);
    expect(vi.isMockFunction(mock.off)).toBe(true);
    expect(vi.isMockFunction(mock.once)).toBe(true);

    expect(vi.isMockFunction(mock.messageBus)).toBe(true);
    expect(vi.isMockFunction(mock.publisher)).toBe(true);
    expect(vi.isMockFunction(mock.workerQueue)).toBe(true);
    expect(vi.isMockFunction(mock.stream)).toBe(true);
    expect(vi.isMockFunction(mock.rpcClient)).toBe(true);
    expect(vi.isMockFunction(mock.rpcServer)).toBe(true);
  });

  it("should return sensible defaults", () => {
    const mock = createMockIrisSource();

    expect(mock.hasMessage({} as any)).toBe(true);
    expect(mock.getConnectionState()).toBe("connected");
  });

  it("should resolve ping to true", async () => {
    const mock = createMockIrisSource();

    await expect(mock.ping()).resolves.toBe(true);
  });

  it("should return sub-mocks from factory methods", () => {
    const mock = createMockIrisSource();

    expect(mock.messageBus({} as any)).toBeDefined();
    expect(mock.publisher({} as any)).toBeDefined();
    expect(mock.workerQueue({} as any)).toBeDefined();
    expect(mock.rpcClient({} as any, {} as any)).toBeDefined();
  });

  it("should return a new mock session from session()", () => {
    const mock = createMockIrisSource();
    const session = mock.session();

    expect(session).not.toBe(mock);
    expect(session.driver).toBe("memory");
    expect(vi.isMockFunction(session.ping)).toBe(true);
  });
});
