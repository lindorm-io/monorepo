import { createMockPublisher } from "./vitest.js";
import { beforeEach, describe, expect, it } from "vitest";

type TestMessage = { id: string; body: string };

describe("createMockPublisher", () => {
  let mock: ReturnType<typeof createMockPublisher<TestMessage>>;

  beforeEach(() => {
    mock = createMockPublisher<TestMessage>();
  });

  describe("create", () => {
    it("should return empty object by default", () => {
      expect(mock.create()).toMatchSnapshot();
    });

    it("should track calls", () => {
      mock.create({ id: "1" });
      expect(mock.create).toHaveBeenCalledWith({ id: "1" });
    });
  });

  describe("hydrate", () => {
    it("should return data as message", () => {
      const result = mock.hydrate({ id: "1", body: "hello" });
      expect(result).toMatchSnapshot();
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
      expect(mock.validate).toHaveBeenCalledWith({ id: "1", body: "hello" });
    });
  });

  describe("publish", () => {
    it("should record a single message", async () => {
      const msg: TestMessage = { id: "1", body: "hello" };
      await mock.publish(msg);
      expect(mock.published).toMatchSnapshot();
      expect(mock.publish).toHaveBeenCalledWith(msg);
    });

    it("should record an array of messages", async () => {
      const msgs: Array<TestMessage> = [
        { id: "1", body: "a" },
        { id: "2", body: "b" },
      ];
      await mock.publish(msgs);
      expect(mock.published).toMatchSnapshot();
    });

    it("should accumulate across calls", async () => {
      await mock.publish({ id: "1", body: "a" });
      await mock.publish({ id: "2", body: "b" });
      expect(mock.published).toHaveLength(2);
    });
  });

  describe("clearPublished", () => {
    it("should clear the published array", async () => {
      await mock.publish({ id: "1", body: "hello" });
      expect(mock.published).toHaveLength(1);
      mock.clearPublished();
      expect(mock.published).toHaveLength(0);
    });
  });
});
