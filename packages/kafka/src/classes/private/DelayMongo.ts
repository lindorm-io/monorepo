import { IMongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { IKafkaDelayEnvelope, IKafkaDelayStore } from "../../interfaces";
import { KafkaDelayOptions } from "../../types";

type Document = Omit<IKafkaDelayEnvelope, "value"> & {
  value: string;
};

export class DelayMongo implements IKafkaDelayStore {
  private readonly collection: Collection<Document>;

  public constructor(source: IMongoSource) {
    this.collection = source.database.collection("lindorm_kafka_message_delay");
  }

  // public

  public async add(envelope: KafkaDelayOptions): Promise<void> {
    await this.collection.insertOne({
      id: randomUUID(),
      key: envelope.key,
      topic: envelope.topic,
      value: envelope.value.toString("base64"),
      timestamp: Date.now() + envelope.delay,
    });
  }

  public async get(topic: string): Promise<Array<IKafkaDelayEnvelope>> {
    const array = await this.collection
      .find({ topic, timestamp: { $lte: Date.now() } })
      .sort({ timestamp: 1 })
      .toArray();

    return array.map((doc) => ({ ...doc, value: Buffer.from(doc.value, "base64") }));
  }

  public async ack(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }
}
