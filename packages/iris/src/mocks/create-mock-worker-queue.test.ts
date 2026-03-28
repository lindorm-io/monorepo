import { createMockWorkerQueue } from "./create-mock-worker-queue";

type TestMessage = { id: string; body: string };

describe("createMockWorkerQueue", () => {
  let mock: ReturnType<typeof createMockWorkerQueue<TestMessage>>;

  beforeEach(() => {
    mock = createMockWorkerQueue<TestMessage>();
  });

  describe("create", () => {
    it("should return empty object by default", () => {
      expect(mock.create()).toMatchSnapshot();
    });
  });

  describe("hydrate", () => {
    it("should return data as message", () => {
      expect(mock.hydrate({ id: "1", body: "hello" })).toMatchSnapshot();
    });
  });

  describe("copy", () => {
    it("should return shallow copy", () => {
      const original: TestMessage = { id: "1", body: "hello" };
      const result = mock.copy(original);
      expect(result).toEqual(original);
      expect(result).not.toBe(original);
    });
  });

  describe("validate", () => {
    it("should be a no-op", () => {
      expect(() => mock.validate({ id: "1", body: "hello" })).not.toThrow();
    });
  });

  describe("publish", () => {
    it("should record a single message", async () => {
      await mock.publish({ id: "1", body: "hello" });
      expect(mock.published).toMatchSnapshot();
    });

    it("should record an array of messages", async () => {
      await mock.publish([
        { id: "1", body: "a" },
        { id: "2", body: "b" },
      ]);
      expect(mock.published).toMatchSnapshot();
    });
  });

  describe("consume", () => {
    it("should accept a string queue name and callback", async () => {
      const callback = jest.fn();
      await mock.consume("my-queue", callback);
      expect(mock.consume).toHaveBeenCalledWith("my-queue", callback);
    });

    it("should accept ConsumeOptions object", async () => {
      const callback = jest.fn();
      await mock.consume({ queue: "my-queue", callback });
      expect(mock.consume).toHaveBeenCalledWith({
        queue: "my-queue",
        callback,
      });
    });

    it("should accept an array of ConsumeOptions", async () => {
      const callback = jest.fn();
      await mock.consume([
        { queue: "q1", callback },
        { queue: "q2", callback },
      ]);
      expect(mock.consume).toHaveBeenCalledTimes(1);
    });
  });

  describe("unconsume", () => {
    it("should accept a queue name", async () => {
      await mock.unconsume("my-queue");
      expect(mock.unconsume).toHaveBeenCalledWith("my-queue");
    });
  });

  describe("unconsumeAll", () => {
    it("should be callable", async () => {
      await mock.unconsumeAll();
      expect(mock.unconsumeAll).toHaveBeenCalled();
    });
  });

  describe("clearPublished", () => {
    it("should clear the published array", async () => {
      await mock.publish({ id: "1", body: "hello" });
      mock.clearPublished();
      expect(mock.published).toHaveLength(0);
    });
  });
});
