import { createMockLogger } from "@lindorm/logger";
import { sleep, wait } from "@lindorm/utils";
import Db, { Database } from "better-sqlite3";
import { IKafkaDelayEnvelope } from "../../interfaces";
import { KafkaDelayOptions } from "../../types";
import { KafkaDelayService } from "./KafkaDelayService";

describe("KafkaDelayService", () => {
  let db: Database;
  let service: KafkaDelayService;
  let callback: jest.Mock;

  const TOPIC = "test.topic";

  beforeEach(() => {
    db = new Db(":memory:");
    service = new KafkaDelayService({
      sqlite: db,
      logger: createMockLogger(),
    });

    callback = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await service.disconnect();
    db.close();
  });

  const createEnvelope = (override?: Partial<KafkaDelayOptions>): KafkaDelayOptions => ({
    topic: TOPIC,
    key: "test-key",
    value: Buffer.from("hello"),
    delay: 0,
    ...override,
  });

  test("should delay and poll immediate message", async () => {
    await service.delay(createEnvelope());

    service.poll(TOPIC, callback);

    await wait(() => callback.mock.calls.length === 1);
    expect(callback).toHaveBeenCalledTimes(1);

    const envelope: IKafkaDelayEnvelope = callback.mock.calls[0][0];

    expect(envelope.topic).toBe(TOPIC);
    expect(envelope.value.equals(Buffer.from("hello"))).toBe(true);
  });

  test("should ignore delayed messages until time passes", async () => {
    await service.delay(createEnvelope({ delay: 100 }));

    service.poll(TOPIC, callback);

    await sleep(50);
    expect(callback).not.toHaveBeenCalled();

    await wait(() => callback.mock.calls.length === 1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("should stop polling when stopped", async () => {
    await service.delay(createEnvelope());
    service.poll(TOPIC, callback);

    await wait(() => callback.mock.calls.length === 1);
    expect(callback).toHaveBeenCalledTimes(1);

    await service.stop(TOPIC);
    await service.delay(createEnvelope());

    await sleep(150);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("should support multiple topics independently", async () => {
    const topicA = "topic.A";
    const topicB = "topic.B";
    const callbackA = jest.fn().mockResolvedValue(undefined);
    const callbackB = jest.fn().mockResolvedValue(undefined);

    await service.delay(createEnvelope({ topic: topicA }));
    await service.delay(createEnvelope({ topic: topicB }));

    service.poll(topicA, callbackA);
    service.poll(topicB, callbackB);

    await wait(() => callbackA.mock.calls.length === 1);
    await wait(() => callbackB.mock.calls.length === 1);

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledTimes(1);
  });
});
