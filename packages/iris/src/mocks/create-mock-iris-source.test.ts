import { createMockIrisSource } from "./create-mock-iris-source";

describe("createMockIrisSource", () => {
  it("should create a mock with default values", () => {
    const mock = createMockIrisSource();

    expect(mock.driver).toBe("memory");
    expect(mock.messages).toEqual([]);
  });

  it("should have all methods as jest.fn()", () => {
    const mock = createMockIrisSource();

    expect(jest.isMockFunction(mock.addMessages)).toBe(true);
    expect(jest.isMockFunction(mock.hasMessage)).toBe(true);
    expect(jest.isMockFunction(mock.addSubscriber)).toBe(true);
    expect(jest.isMockFunction(mock.removeSubscriber)).toBe(true);
    expect(jest.isMockFunction(mock.clone)).toBe(true);

    expect(jest.isMockFunction(mock.connect)).toBe(true);
    expect(jest.isMockFunction(mock.disconnect)).toBe(true);
    expect(jest.isMockFunction(mock.drain)).toBe(true);
    expect(jest.isMockFunction(mock.ping)).toBe(true);
    expect(jest.isMockFunction(mock.setup)).toBe(true);
    expect(jest.isMockFunction(mock.getConnectionState)).toBe(true);
    expect(jest.isMockFunction(mock.onConnectionStateChange)).toBe(true);

    expect(jest.isMockFunction(mock.messageBus)).toBe(true);
    expect(jest.isMockFunction(mock.publisher)).toBe(true);
    expect(jest.isMockFunction(mock.workerQueue)).toBe(true);
    expect(jest.isMockFunction(mock.stream)).toBe(true);
    expect(jest.isMockFunction(mock.rpcClient)).toBe(true);
    expect(jest.isMockFunction(mock.rpcServer)).toBe(true);
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

  it("should return a new mock from clone", () => {
    const mock = createMockIrisSource();
    const cloned = mock.clone();

    expect(cloned).not.toBe(mock);
    expect(cloned.driver).toBe("memory");
    expect(jest.isMockFunction(cloned.connect)).toBe(true);
  });
});
