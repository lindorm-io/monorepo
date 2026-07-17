// Kafka RPC reply-topic leak (M6) — real-broker weekly assertion.
//
// Every Kafka RPC client mints a unique reply topic. Before the fix that topic
// was never deleted on close(), so short-lived clients accumulated orphan
// topics on the broker. This proves close() tears the reply topic down.
//
// Requires Kafka running (via docker-compose).

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../interfaces/index.js";
import { IrisSource } from "../../classes/IrisSource.js";
import type { KafkaDriver } from "../drivers/kafka/classes/KafkaDriver.js";
import type { KafkaSharedState } from "../drivers/kafka/types/kafka-types.js";
import { createTckMessages } from "../__fixtures__/tck/create-tck-messages.js";
import { createTckAmphora } from "../__fixtures__/tck/create-tck-amphora.js";
import { wait, waitFor } from "../__fixtures__/tck/wait.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000 });

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const messages = createTckMessages([]);

let source: IrisSource;

const listTopics = async (): Promise<Array<string>> => {
  const driver = (source as any)._driver as KafkaDriver;
  const state = (driver as any).state as KafkaSharedState;
  const admin = state.kafka!.admin();
  try {
    await admin.connect();
    return await admin.listTopics();
  } finally {
    await admin.disconnect();
  }
};

describe("TCK: Kafka RPC reply-topic leak (M6)", () => {
  beforeAll(async () => {
    const prefix = `iris-tck-${randomUUID().slice(0, 8)}`;
    const amphora = await createTckAmphora();

    source = new IrisSource({
      driver: "kafka",
      brokers: ["localhost:9092"],
      prefix,
      logger: createMockLogger() as any,
      messages: [messages.TckRpcRequest, messages.TckRpcResponse] as Array<
        Constructor<IMessage>
      >,
      amphora,
      sessionTimeoutMs: 15000,
    });

    await source.connect();
    await source.setup();
  });

  afterAll(async () => {
    try {
      await source.disconnect();
    } catch {
      // best-effort; docker cleanup handles the rest
    }
  });

  it("should delete the client's reply topic on close", async () => {
    const { TckRpcRequest, TckRpcResponse } = messages;

    const server = source.rpcServer(TckRpcRequest, TckRpcResponse);
    const client = source.rpcClient(TckRpcRequest, TckRpcResponse);

    await server.serve(async (req) => {
      const res = new TckRpcResponse();
      res.answer = `answer-to-${req.question}`;
      return res;
    });

    await wait(500);

    // A roundtrip forces lazy creation of the client's unique reply topic.
    const req = new TckRpcRequest();
    req.question = "leak-check";
    const response = await client.request(req, { timeout: 8000 });
    expect(response.answer).toBe("answer-to-leak-check");

    const replyTopic = (client as any).replyTopic as string;
    expect(replyTopic).toMatch(/\.rpc\.reply\./);

    // The reply topic exists on the broker while the client is open.
    await waitFor(async () => (await listTopics()).includes(replyTopic), 10000);

    await client.close();

    // After close() the broker eventually reports the reply topic gone.
    await waitFor(async () => !(await listTopics()).includes(replyTopic), 15000);

    await server.unserveAll();
  });
});
