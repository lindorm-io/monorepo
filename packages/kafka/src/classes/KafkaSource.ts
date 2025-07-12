import { ILogger } from "@lindorm/logger";
import {
  globalMessageMetadata,
  IMessage,
  IMessageSubscriptions,
  MessageScanner,
  MessageScannerInput,
  MessageSubscriptions,
} from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { Kafka, Partitioners, Producer } from "kafkajs";
import { KafkaSourceError } from "../errors";
import { IKafkaMessageBus, IKafkaSource } from "../interfaces";
import {
  CloneKafkaSourceOptions,
  KafkaSourceMessageBusOptions,
  KafkaSourceOptions,
} from "../types";
import { FromClone } from "../types/private";
import { KafkaMessageBus } from "./KafkaMessageBus";
import { Sqlite } from "./private";

export class KafkaSource implements IKafkaSource {
  public readonly name = "KafkaSource";

  private readonly cache: Map<Constructor<IMessage>, IKafkaMessageBus<IMessage>>;
  private readonly kafka: Kafka;
  private readonly logger: ILogger;
  private readonly messages: Array<Constructor<IMessage>>;
  private readonly producer: Producer;
  private readonly sqlite: Sqlite;
  private readonly subscriptions: IMessageSubscriptions;

  public constructor(options: KafkaSourceOptions);
  public constructor(fromClone: FromClone);
  public constructor(options: KafkaSourceOptions | FromClone) {
    this.logger = options.logger.child(["KafkaSource"]);

    if ("_mode" in options && options._mode === "from_clone") {
      const opts = options as FromClone;

      this.cache = opts.buses;
      this.kafka = opts.kafka;
      this.messages = opts.messages;
      this.producer = opts.producer;
      this.sqlite = opts.sqlite;
      this.subscriptions = opts.subscriptions;
    } else {
      const opts = options as KafkaSourceOptions;

      this.cache = new Map();
      this.messages = opts.messages ? MessageScanner.scan(opts.messages) : [];
      this.sqlite = new Sqlite(process.cwd());
      this.subscriptions = new MessageSubscriptions();

      this.kafka = new Kafka({
        ...(opts.config ?? {}),
        brokers: opts.brokers,
        logLevel: 0,
      });

      this.producer = this.kafka.producer({
        createPartitioner: Partitioners.LegacyPartitioner,
      });
    }
  }

  // public

  public get client(): Kafka {
    return this.kafka;
  }

  public addMessages(messages: MessageScannerInput): void {
    this.messages.push(
      ...MessageScanner.scan(messages).filter(
        (Message) => !this.messages.includes(Message),
      ),
    );
  }

  public clone(options: CloneKafkaSourceOptions = {}): IKafkaSource {
    return new KafkaSource({
      _mode: "from_clone",
      buses: this.cache,
      kafka: this.kafka,
      logger: options.logger ?? this.logger,
      messages: this.messages,
      producer: this.producer,
      sqlite: this.sqlite,
      subscriptions: this.subscriptions,
    });
  }

  public async connect(): Promise<void> {
    await this.producer.connect();
  }

  public async disconnect(): Promise<void> {
    for (const target of this.messages) {
      await this.messageBus(target).disconnect();
    }

    this.sqlite.disconnect();

    await this.producer.disconnect();
  }

  public messageBus<M extends IMessage>(
    target: Constructor<M>,
    options: KafkaSourceMessageBusOptions = {},
  ): IKafkaMessageBus<M> {
    if (!this.cache.has(target)) {
      this.messageExists(target);

      this.cache.set(
        target,
        new KafkaMessageBus<M>({
          kafka: this.kafka,
          logger: options.logger ?? this.logger,
          producer: this.producer,
          sqlite: this.sqlite,
          subscriptions: this.subscriptions,
          target,
        }),
      );
    }

    return this.cache.get(target) as IKafkaMessageBus<M>;
  }

  public async setup(): Promise<void> {
    await this.connect();
  }

  // private

  private messageExists<M extends IMessage>(target: Constructor<M>): void {
    const config = this.messages.find((m) => m === target);

    if (!config) {
      throw new KafkaSourceError("Message not found in messages list", {
        debug: { target },
      });
    }

    const metadata = globalMessageMetadata.get(target);

    if (metadata.message.decorator !== "Message") {
      throw new KafkaSourceError(`Message is not decorated with @Message`, {
        debug: { target },
      });
    }
  }
}
