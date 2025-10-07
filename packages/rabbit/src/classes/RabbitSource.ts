import { JsonKit } from "@lindorm/json-kit";
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
import { sleep } from "@lindorm/utils";
import amqplib, { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { RabbitSourceError } from "../errors";
import { IRabbitMessageBus, IRabbitPublisher, IRabbitSource } from "../interfaces";
import {
  RabbitSourceMessageBusOptions,
  RabbitSourceOptions,
  WithLoggerOptions,
} from "../types";
import { FromClone } from "../types/private";
import { bindQueue } from "../utils";
import { RabbitMessageBus } from "./RabbitMessageBus";
import { RabbitPublisher } from "./RabbitPublisher";

export class RabbitSource implements IRabbitSource {
  public readonly __instanceof = "RabbitSource";

  private readonly cache: Map<Constructor<IMessage>, IRabbitMessageBus<IMessage>>;
  private readonly deadletters: string;
  private readonly exchange: string;
  private readonly logger: ILogger;
  private readonly messages: Array<Constructor<IMessage>>;
  private readonly nackTimeout: number;
  private readonly promise: Promise<ChannelModel>;
  private readonly subscriptions: IMessageSubscriptions;

  private confirmChannel: ConfirmChannel | undefined;
  private channelModel: ChannelModel | undefined;

  public constructor(options: RabbitSourceOptions);
  public constructor(fromClone: FromClone);
  public constructor(options: RabbitSourceOptions | FromClone) {
    this.logger = options.logger.child(["RabbitSource"]);
    this.deadletters = options.deadletters ?? "deadletters";
    this.exchange = options.exchange ?? "exchange";
    this.nackTimeout = options.nackTimeout ?? 3000;

    if ("_mode" in options && options._mode === "from_clone") {
      this.cache = options.cache;
      this.confirmChannel = options.confirmChannel;
      this.promise = Promise.resolve(options.channelModel);
      this.channelModel = options.channelModel;
      this.messages = options.messages;
      this.subscriptions = options.subscriptions;
    } else {
      const opts = options as RabbitSourceOptions;

      this.cache = new Map();
      this.messages = opts.messages ? MessageScanner.scan(opts.messages) : [];
      this.promise = this.connectWithRetry(opts);
      this.subscriptions = new MessageSubscriptions();
    }
  }

  // public

  public get client(): ChannelModel {
    if (!this.channelModel) {
      throw new RabbitSourceError("Connection not established");
    }
    return this.channelModel;
  }

  public clone(options: WithLoggerOptions = {}): IRabbitSource {
    if (!this.channelModel) {
      throw new RabbitSourceError("Connection not established");
    }
    if (!this.confirmChannel) {
      throw new RabbitSourceError("Channel not established");
    }
    return new RabbitSource({
      _mode: "from_clone",
      cache: this.cache,
      channelModel: this.channelModel,
      confirmChannel: this.confirmChannel,
      deadletters: this.deadletters,
      exchange: this.exchange,
      logger: options.logger ?? this.logger,
      messages: this.messages,
      nackTimeout: this.nackTimeout,
      subscriptions: this.subscriptions,
    });
  }

  public async connect(): Promise<void> {
    this.channelModel = await this.promise;
  }

  public async disconnect(): Promise<void> {
    await this.confirmChannel?.close();
    await this.channelModel?.close();
  }

  public async setup(): Promise<void> {
    if (!this.channelModel) {
      await this.connect();
    }

    this.confirmChannel = await this.client.createConfirmChannel();
    this.confirmChannel.on("return", this.onReturnedMessage.bind(this));

    await this.confirmChannel.assertExchange(this.exchange, "topic", { durable: true });
    await bindQueue({
      channel: this.confirmChannel,
      exchange: this.exchange,
      logger: this.logger,
      queue: this.deadletters,
      topic: this.deadletters,
    });
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
    options: RabbitSourceMessageBusOptions = {},
  ): IRabbitMessageBus<M> {
    if (!this.cache.has(target)) {
      this.messageExists(target);

      this.cache.set(
        target,
        new RabbitMessageBus<M>({
          channel: this.channel,
          deadletters: this.deadletters,
          exchange: this.exchange,
          logger: options.logger ?? this.logger,
          nackTimeout: options.nackTimeout ?? this.nackTimeout,
          subscriptions: this.subscriptions,
          target: target,
        }),
      );
    }

    return this.cache.get(target) as IRabbitMessageBus<M>;
  }

  public publisher<M extends IMessage>(
    target: Constructor<M>,
    options: WithLoggerOptions = {},
  ): IRabbitPublisher<M> {
    this.messageExists(target);

    return new RabbitPublisher<M>({
      channel: this.channel,
      exchange: this.exchange,
      logger: options.logger ?? this.logger,
      target: target,
    });
  }

  // private

  private get channel(): ConfirmChannel {
    if (!this.confirmChannel) {
      throw new RabbitSourceError("Channel not established");
    }
    return this.confirmChannel;
  }

  private messageExists<M extends IMessage>(target: Constructor<M>): void {
    const config = this.messages.find((m) => m === target);

    if (!config) {
      throw new RabbitSourceError("Message not found in messages list", {
        debug: { target },
      });
    }

    const metadata = globalMessageMetadata.get(target);

    if (metadata.message.decorator !== "Message") {
      throw new RabbitSourceError(`Message is not decorated with @Message`, {
        debug: { target },
      });
    }
  }

  private onReturnedMessage(msg: ConsumeMessage): void {
    const message = JsonKit.parse(msg.content);

    this.channel.publish(
      this.exchange,
      this.deadletters,
      msg.content,
      { persistent: true, mandatory: message.mandatory === true },
      (error) => {
        if (error) {
          this.logger.error("Failed to deadletter returned message", error, [
            { message },
          ]);
        } else {
          this.logger.warn("Deadlettered returned message", { message });
        }
      },
    );
  }

  private async connectWithRetry(
    options: RabbitSourceOptions,
    start = Date.now(),
  ): Promise<ChannelModel> {
    const connectInterval = options.connectInterval ?? 250;
    const connectTimeout = options.connectTimeout ?? 10000;

    try {
      const connection = options.config
        ? amqplib.connect(options.config)
        : amqplib.connect(options.url);

      await connection;

      this.logger.debug("Connection established", { time: Date.now() - start });

      return connection;
    } catch (err: any) {
      this.logger.debug("Connection error", err);

      await sleep(connectInterval);

      if (Date.now() > start + connectTimeout) {
        throw new RabbitSourceError("Connection Timeout", { error: err });
      }

      return this.connectWithRetry(options, start);
    }
  }
}
