import { LindormError } from "@lindorm/errors";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import amqplib, { ConfirmChannel, Connection, ConsumeMessage } from "amqplib";
import { AmqpSourceError } from "../errors";
import { IAmqpMessage, IAmqpMessageBus, IAmqpSource } from "../interfaces";
import {
  AmqpSourceMessage,
  AmqpSourceMessageBusOptions,
  AmqpSourceOptions,
} from "../types";
import { bindQueue } from "../utils";
import { AmqpMessageBus } from "./AmqpMessageBus";
import { MessageScanner, SubscriptionList } from "./private";

export class AmqpSource implements IAmqpSource {
  private readonly deadletters: string;
  private readonly exchange: string;
  private readonly logger: ILogger;
  private readonly messages: Array<AmqpSourceMessage>;
  private readonly nackTimeout: number;
  private readonly promise: Promise<Connection>;
  private readonly subscriptions: SubscriptionList;

  private confirmChannel: ConfirmChannel | undefined;
  private connection: Connection | undefined;

  public constructor(options: AmqpSourceOptions) {
    this.logger = options.logger.child(["AmqpSource"]);
    this.deadletters = options.deadletters ?? "deadletters";
    this.exchange = options.exchange ?? "exchange";
    this.nackTimeout = options.nackTimeout ?? 3000;
    this.subscriptions = new SubscriptionList();

    this.promise = this.connectWithRetry(options);

    this.messages = options.messages ? MessageScanner.scan(options.messages) : [];
  }

  // public

  public get client(): Connection {
    if (!this.connection) {
      throw new LindormError("Connection not established");
    }
    return this.connection;
  }

  public async connect(): Promise<void> {
    this.connection = await this.promise;
  }

  public async disconnect(): Promise<void> {
    await this.confirmChannel?.close();
    await this.connection?.close();
  }

  public messageBus<M extends IAmqpMessage>(
    Message: Constructor<M>,
    options: AmqpSourceMessageBusOptions<M> = {},
  ): IAmqpMessageBus<M> {
    const config = this.messageConfig(Message);

    return new AmqpMessageBus<M>({
      Message: config.Message,
      channel: this.channel,
      deadletters: this.deadletters,
      exchange: this.exchange,
      logger: options.logger ?? this.logger,
      nackTimeout: options.nackTimeout ?? this.nackTimeout,
      subscriptions: this.subscriptions,
      validate: options.validate ?? config.validate,
    });
  }

  public async setup(): Promise<void> {
    if (!this.connection) {
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
      throw new LindormError("Channel not established");
    }
    return this.confirmChannel;
  }

  private messageConfig<M extends IAmqpMessage>(
    Message: Constructor<M>,
  ): AmqpSourceMessage<M> {
    const config = this.messages.find((message) => message.Message === Message);

    if (config) {
      return config as AmqpSourceMessage<M>;
    }

    throw new AmqpSourceError("Message not found in entities list", {
      debug: { Message },
    });
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
    options: AmqpSourceOptions,
    start = Date.now(),
  ): Promise<Connection> {
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
        throw new LindormError("Connection Timeout", { error: err });
      }

      return this.connectWithRetry(options, start);
    }
  }
}
