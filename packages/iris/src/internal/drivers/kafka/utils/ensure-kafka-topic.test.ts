import type { KafkaClient, KafkaSharedState } from "../types/kafka-types";
import { ensureKafkaTopic, ensureKafkaTopicFromState } from "./ensure-kafka-topic";
import { describe, expect, it, vi } from "vitest";

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockAdmin = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  listTopics: vi.fn().mockResolvedValue([]),
  createTopics: vi.fn().mockResolvedValue(true),
  deleteTopics: vi.fn().mockResolvedValue(undefined),
});

const createMockKafka = (admin = createMockAdmin()): KafkaClient => ({
  producer: vi.fn() as any,
  consumer: vi.fn() as any,
  admin: vi.fn().mockReturnValue(admin),
});

describe("ensureKafkaTopic", () => {
  it("should skip if topic already in createdTopics", async () => {
    const kafka = createMockKafka();
    const logger = createMockLogger();
    const createdTopics = new Set(["existing-topic"]);

    await ensureKafkaTopic(kafka, "existing-topic", createdTopics, logger as any);

    expect(kafka.admin).not.toHaveBeenCalled();
  });

  it("should create topic and add to createdTopics", async () => {
    const admin = createMockAdmin();
    const kafka = createMockKafka(admin);
    const logger = createMockLogger();
    const createdTopics = new Set<string>();

    await ensureKafkaTopic(kafka, "new-topic", createdTopics, logger as any);

    expect(admin.connect).toHaveBeenCalledTimes(1);
    expect(admin.createTopics).toHaveBeenCalledWith({
      topics: [{ topic: "new-topic" }],
      waitForLeaders: true,
    });
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
    expect(createdTopics.has("new-topic")).toBe(true);
  });

  it("should handle createTopics failure gracefully", async () => {
    const admin = createMockAdmin();
    admin.createTopics.mockRejectedValue(new Error("Topic already exists"));
    const kafka = createMockKafka(admin);
    const logger = createMockLogger();
    const createdTopics = new Set<string>();

    await ensureKafkaTopic(kafka, "existing-topic", createdTopics, logger as any);

    expect(createdTopics.has("existing-topic")).toBe(true);
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
  });

  it("should disconnect admin even on connect failure", async () => {
    const admin = createMockAdmin();
    admin.connect.mockRejectedValue(new Error("Connection failed"));
    const kafka = createMockKafka(admin);
    const logger = createMockLogger();
    const createdTopics = new Set<string>();

    await ensureKafkaTopic(kafka, "topic", createdTopics, logger as any);

    expect(admin.disconnect).toHaveBeenCalledTimes(1);
    expect(createdTopics.has("topic")).toBe(true);
  });
});

describe("ensureKafkaTopicFromState", () => {
  it("should throw when kafka client is null", async () => {
    const state = {
      kafka: null,
      createdTopics: new Set<string>(),
    } as any as KafkaSharedState;
    const logger = createMockLogger();

    await expect(
      ensureKafkaTopicFromState(state, "topic", logger as any),
    ).rejects.toThrow("Cannot ensure topic: Kafka client is not connected");
  });

  it("should delegate to ensureKafkaTopic with state fields", async () => {
    const admin = createMockAdmin();
    const kafka = createMockKafka(admin);
    const state = {
      kafka,
      createdTopics: new Set<string>(),
    } as any as KafkaSharedState;
    const logger = createMockLogger();

    await ensureKafkaTopicFromState(state, "my-topic", logger as any);

    expect(admin.createTopics).toHaveBeenCalledWith({
      topics: [{ topic: "my-topic" }],
      waitForLeaders: true,
    });
    expect(state.createdTopics.has("my-topic")).toBe(true);
  });
});
