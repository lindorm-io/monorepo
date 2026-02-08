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
import {
  IKafkaDelayService,
  IKafkaMessageBus,
  IKafkaPublisher,
  IKafkaSource,
} from "../interfaces";
import { KafkaSourceOptions, WithLoggerOptions } from "../types";
import { FromClone } from "../types/private";
import { KafkaMessageBus } from "./KafkaMessageBus";
import { KafkaPublisher } from "./KafkaPublisher";
import { KafkaDelayService } from "./private";

export class KafkaSource implements IKafkaSource {
  public readonly __instanceof = "KafkaSource";

  private readonly cache: Map<Constructor<IMessage>, IKafkaMessageBus<IMessage>>;
  private readonly kafka: Kafka;
  private readonly logger: ILogger;
  private readonly messages: Array<Constructor<IMessage>>;
  private readonly producer: Producer;
  private readonly delayService: IKafkaDelayService;
  private readonly subscriptions: IMessageSubscriptions;

  public constructor(options: KafkaSourceOptions);
  public constructor(fromClone: FromClone);
  public constructor(options: KafkaSourceOptions | FromClone) {
    this.logger = options.logger.child(["KafkaSource"]);

    if ("_mode" in options && options._mode === "from_clone") {
      this.cache = options.buses;
      this.delayService = options.delayService;
      this.kafka = options.kafka;
      this.messages = options.messages;
      this.producer = options.producer;
      this.subscriptions = options.subscriptions;
    } else {
      const opts = options as KafkaSourceOptions;

      this.cache = new Map();

      this.delayService = new KafkaDelayService({
        ...(opts.delay ?? {}),
        logger: this.logger,
      });

      this.messages = opts.messages ? MessageScanner.scan(opts.messages) : [];
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

  public clone(options: WithLoggerOptions = {}): IKafkaSource {
    return new KafkaSource({
      _mode: "from_clone",
      buses: this.cache,
      kafka: this.kafka,
      logger: options.logger ?? this.logger,
      messages: this.messages,
      producer: this.producer,
      delayService: this.delayService,
      subscriptions: this.subscriptions,
    });
  }

  public async connect(): Promise<void> {
    await this.producer.connect();
  }

  public async disconnect(): Promise<void> {
    await this.delayService.disconnect();

    for (const target of this.messages) {
      await this.messageBus(target).disconnect();
    }

    await this.producer.disconnect();
  }

  public async ping(): Promise<void> {
    await this.producer.send({
      acks: -1,
      messages: [],
      topic: "ping",
    });

    this.logger.debug("Ping successful", { context: "KafkaSource" });
  }

  public async setup(): Promise<void> {
    await this.connect();
  }

  public addMessages(messages: MessageScannerInput): void {
    this.messages.push(
      ...MessageScanner.scan(messages).filter(
        (Message) => !this.messages.includes(Message),
      ),
    );
  }

  public hasMessage(target: Constructor<IMessage>): boolean {
    return this.messages.includes(target);
  }

  public messageBus<M extends IMessage>(
    target: Constructor<M>,
    options: WithLoggerOptions = {},
  ): IKafkaMessageBus<M> {
    if (!this.cache.has(target)) {
      this.messageExists(target);

      this.cache.set(
        target,
        new KafkaMessageBus<M>({
          delayService: this.delayService,
          kafka: this.kafka,
          logger: options.logger ?? this.logger,
          producer: this.producer,
          subscriptions: this.subscriptions,
          target,
        }),
      );
    }

    return this.cache.get(target) as IKafkaMessageBus<M>;
  }

  public publisher<M extends IMessage>(
    target: Constructor<M>,
    options: WithLoggerOptions = {},
  ): IKafkaPublisher<M> {
    this.messageExists(target);

    return new KafkaPublisher<M>({
      delayService: this.delayService,
      logger: options.logger ?? this.logger,
      producer: this.producer,
      target,
    });
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
