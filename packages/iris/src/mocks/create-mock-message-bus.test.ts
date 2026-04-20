import { createMockMessageBus } from "./jest";

type TestMessage = { id: string; body: string };

describe("createMockMessageBus", () => {
  let mock: ReturnType<typeof createMockMessageBus<TestMessage>>;

  beforeEach(() => {
    mock = createMockMessageBus<TestMessage>();
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

  describe("subscribe", () => {
    it("should accept options and be callable", async () => {
      const callback = jest.fn();
      await mock.subscribe({ topic: "test-topic", callback });
      expect(mock.subscribe).toHaveBeenCalledWith({
        topic: "test-topic",
        callback,
      });
    });

    it("should accept an array of options", async () => {
      const callback = jest.fn();
      await mock.subscribe([
        { topic: "topic-a", callback },
        { topic: "topic-b", callback },
      ]);
      expect(mock.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("unsubscribe", () => {
    it("should accept topic and optional queue", async () => {
      await mock.unsubscribe({ topic: "test-topic", queue: "q1" });
      expect(mock.unsubscribe).toHaveBeenCalledWith({
        topic: "test-topic",
        queue: "q1",
      });
    });
  });

  describe("unsubscribeAll", () => {
    it("should be callable", async () => {
      await mock.unsubscribeAll();
      expect(mock.unsubscribeAll).toHaveBeenCalled();
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
