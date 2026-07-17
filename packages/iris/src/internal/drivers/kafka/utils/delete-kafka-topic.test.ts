import type { KafkaSharedState } from "../types/kafka-types.js";
import { deleteKafkaTopicFromState } from "./delete-kafka-topic.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMockLogger = () =>
  ({
    child: vi.fn().mockReturnThis(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    silly: vi.fn(),
    verbose: vi.fn(),
  }) as any;

const createMockAdmin = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  deleteTopics: vi.fn().mockResolvedValue(undefined),
});

const createState = (admin: ReturnType<typeof createMockAdmin> | null) =>
  ({
    kafka: admin ? ({ admin: () => admin } as any) : null,
    createdTopics: new Set<string>(["iris.rpc.reply.abc"]),
  }) as unknown as KafkaSharedState;

describe("deleteKafkaTopicFromState", () => {
  let admin: ReturnType<typeof createMockAdmin>;

  beforeEach(() => {
    admin = createMockAdmin();
  });

  it("should delete the topic and drop it from createdTopics", async () => {
    const state = createState(admin);

    await deleteKafkaTopicFromState(state, "iris.rpc.reply.abc", createMockLogger());

    expect(admin.connect).toHaveBeenCalledTimes(1);
    expect(admin.deleteTopics).toHaveBeenCalledWith({
      topics: ["iris.rpc.reply.abc"],
    });
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
    expect(state.createdTopics.has("iris.rpc.reply.abc")).toBe(false);
  });

  it("should swallow a deleteTopics failure and still disconnect", async () => {
    admin.deleteTopics.mockRejectedValueOnce(new Error("topic deletion disabled"));
    const state = createState(admin);

    await expect(
      deleteKafkaTopicFromState(state, "iris.rpc.reply.abc", createMockLogger()),
    ).resolves.toBeUndefined();

    // A delete failure must never throw out of close().
    expect(admin.disconnect).toHaveBeenCalledTimes(1);
  });

  it("should no-op when the kafka client is not connected", async () => {
    const state = createState(null);

    await expect(
      deleteKafkaTopicFromState(state, "iris.rpc.reply.abc", createMockLogger()),
    ).resolves.toBeUndefined();
  });
});
