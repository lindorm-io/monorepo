import { createMockWorker } from "./jest";

describe("createMockWorker", () => {
  test("should create mock with expected shape", () => {
    expect(createMockWorker()).toMatchSnapshot();
  });

  test("should resolve trigger", async () => {
    const mock = createMockWorker();

    await expect(mock.trigger()).resolves.toBeUndefined();
    expect(mock.trigger).toHaveBeenCalledTimes(1);
  });

  test("should track start calls", () => {
    const mock = createMockWorker();

    mock.start();

    expect(mock.start).toHaveBeenCalledTimes(1);
  });

  test("should track stop calls", () => {
    const mock = createMockWorker();

    mock.stop();

    expect(mock.stop).toHaveBeenCalledTimes(1);
  });

  test("should track on calls", () => {
    const mock = createMockWorker();

    mock.on("start", jest.fn());

    expect(mock.on).toHaveBeenCalledTimes(1);
  });
});
