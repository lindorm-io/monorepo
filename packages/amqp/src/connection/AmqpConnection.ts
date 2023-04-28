import { ConnectionBase } from "@lindorm-io/core-connection";
import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import { parseBlob } from "@lindorm-io/string-blob";
import amqplib, { ConfirmChannel, Connection, Options } from "amqplib";
import { ConsumeMessage } from "amqplib/properties";
import merge from "deepmerge";
import { AmqpConnectionOptions, IAmqpConnection } from "../types";

export class AmqpConnection
  extends ConnectionBase<Connection, Options.Connect>
  implements IAmqpConnection
{
  private readonly custom: typeof amqplib | undefined;
  private confirmChannel: ConfirmChannel | undefined;

  public readonly deadLetters: string;
  public readonly exchange: string;

  public constructor(options: AmqpConnectionOptions, logger: Logger) {
    const {
      connectInterval,
      connectTimeout,
      deadLetters,
      exchange,
      custom,
      hostname = "localhost",
      port = 5001,
      ...connectOptions
    } = options;

    super(
      {
        connectInterval,
        connectTimeout,
        connectOptions: {
          hostname,
          port,
          ...connectOptions,
        },
        type: "amqp",
      },
      logger,
    );

    this.custom = custom;
    this.deadLetters = deadLetters || "deadletters";
    this.exchange = exchange || "exchange";
  }

  // abstract implementation

  protected async createClientConnection(): Promise<Connection> {
    if (this.custom) {
      return await this.custom.connect(this.connectOptions!);
    }
    return await amqplib.connect(this.connectOptions!);
  }

  protected async connectCallback(): Promise<void> {
    this.client.on("error", this.onError.bind(this));

    this.confirmChannel = await this.client.createConfirmChannel();
    this.confirmChannel.on("return", this.onReturn.bind(this));

    await this.confirmChannel.assertExchange(this.exchange, "topic", { durable: true });
    await this.bindQueue(this.deadLetters, this.deadLetters);
  }

  protected async disconnectCallback(): Promise<void> {
    await this.channel.close();
    await this.client.close();
  }

  // properties

  public get channel(): ConfirmChannel {
    if (!this.confirmChannel) {
      throw new LindormError("Confirm Channel not initialised");
    }
    return this.confirmChannel;
  }
  public set channel(_: ConfirmChannel) {
    throw new LindormError("Invalid operation");
  }

  // public

  public async bindQueue(
    queue: string,
    topic: string,
    options: Options.AssertQueue = {},
  ): Promise<void> {
    await this.channel.assertQueue(queue, merge<Options.AssertQueue>({ durable: true }, options));
    await this.channel.bindQueue(queue, this.exchange, topic);

    this.logger.debug("Successfully bound queue", {
      exchange: this.exchange,
      options,
      queue,
      topic,
    });
  }

  // private event handlers

  private onReturn(msg: ConsumeMessage): void {
    const message = parseBlob(msg.content.toString());

    this.channel.publish(
      this.exchange,
      this.deadLetters,
      msg.content,
      { persistent: true, mandatory: message.mandatory === true },
      (err) => {
        if (err) {
          this.logger.error("Failed to deadletter returned message", { error: err, message });
        } else {
          this.logger.warn("Deadlettered returned message", { message });
        }
      },
    );
  }
}
