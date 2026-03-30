import { createMockCircuitBreaker } from "./create-mock-circuit-breaker";

describe("createMockCircuitBreaker", () => {
  test("should create mock with default values", () => {
    const mock = createMockCircuitBreaker();

    expect(mock.name).toBe("mock");
    expect(mock.state).toBe("closed");
    expect(mock.isOpen).toBe(false);
    expect(mock.isClosed).toBe(true);
    expect(mock.isHalfOpen).toBe(false);
  });

  test("should passthrough execute to fn", async () => {
    const mock = createMockCircuitBreaker();

    const result = await mock.execute(async () => "hello");

    expect(result).toBe("hello");
    expect(mock.execute).toHaveBeenCalledTimes(1);
  });

  test("should allow overriding execute behavior", async () => {
    const mock = createMockCircuitBreaker();
    mock.execute.mockRejectedValue(new Error("circuit open"));

    await expect(mock.execute(async () => "hello")).rejects.toThrow("circuit open");
  });

  test("should track reset calls", () => {
    const mock = createMockCircuitBreaker();

    mock.reset();
    mock.reset();

    expect(mock.reset).toHaveBeenCalledTimes(2);
  });

  test("should track open calls", () => {
    const mock = createMockCircuitBreaker();

    mock.open();

    expect(mock.open).toHaveBeenCalledTimes(1);
  });

  test("should track close calls", () => {
    const mock = createMockCircuitBreaker();

    mock.close();

    expect(mock.close).toHaveBeenCalledTimes(1);
  });
});
