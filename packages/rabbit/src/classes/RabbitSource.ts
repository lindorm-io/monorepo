import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { globalMessageMetadata, IMessage, MessageScanner } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import amqplib, { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { RabbitSourceError } from "../errors";
import { IRabbitMessageBus, IRabbitSource } from "../interfaces";
import {
  CloneRabbitSourceOptions,
  MessageScannerInput,
  RabbitSourceMessageBusOptions,
  RabbitSourceOptions,
} from "../types";
import { FromClone } from "../types/private";
import { bindQueue } from "../utils";
import { RabbitMessageBus } from "./RabbitMessageBus";
import { SubscriptionList } from "./private";

export class RabbitSource implements IRabbitSource {
  public readonly name = "RabbitSource";

  private readonly deadletters: string;
  private readonly exchange: string;
  private readonly logger: ILogger;
  private readonly messages: Array<Constructor<IMessage>>;
  private readonly nackTimeout: number;
  private readonly promise: Promise<ChannelModel>;
  private readonly subscriptions: SubscriptionList;

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
      const opts = options as FromClone;

      this.confirmChannel = opts.confirmChannel;
      this.promise = Promise.resolve(opts.channelModel);
      this.channelModel = opts.channelModel;
      this.messages = opts.messages;
      this.subscriptions = opts.subscriptions;
    } else {
      const opts = options as RabbitSourceOptions;

      this.messages = opts.messages ? MessageScanner.scan(opts.messages) : [];
      this.promise = this.connectWithRetry(opts);
      this.subscriptions = new SubscriptionList();
    }
  }

  // public

  public get client(): ChannelModel {
    if (!this.channelModel) {
      throw new RabbitSourceError("Connection not established");
    }
    return this.channelModel;
  }

  public addMessages(messages: MessageScannerInput): void {
    this.messages.push(
      ...MessageScanner.scan(messages).filter(
        (Message) => !this.messages.includes(Message),
      ),
    );
  }

  public clone(options: CloneRabbitSourceOptions = {}): IRabbitSource {
    if (!this.channelModel) {
      throw new RabbitSourceError("Connection not established");
    }
    if (!this.confirmChannel) {
      throw new RabbitSourceError("Channel not established");
    }
    return new RabbitSource({
      _mode: "from_clone",
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

  public messageBus<M extends IMessage>(
    Message: Constructor<M>,
    options: RabbitSourceMessageBusOptions = {},
  ): IRabbitMessageBus<M> {
    this.messageExists(Message);

    return new RabbitMessageBus<M>({
      Message,
      channel: this.channel,
      deadletters: this.deadletters,
      exchange: this.exchange,
      logger: options.logger ?? this.logger,
      nackTimeout: options.nackTimeout ?? this.nackTimeout,
      subscriptions: this.subscriptions,
    });
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

  // private

  private get channel(): ConfirmChannel {
    if (!this.confirmChannel) {
      throw new RabbitSourceError("Channel not established");
    }
    return this.confirmChannel;
  }

  private messageExists<M extends IMessage>(Message: Constructor<M>): void {
    const config = this.messages.find((m) => m === Message);

    if (!config) {
      throw new RabbitSourceError("Message not found in messages list", {
        debug: { Message },
      });
    }

    const metadata = globalMessageMetadata.get(Message);

    if (metadata.message.decorator !== "Message") {
      throw new RabbitSourceError(`Message is not decorated with @Message`, {
        debug: { Message },
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
