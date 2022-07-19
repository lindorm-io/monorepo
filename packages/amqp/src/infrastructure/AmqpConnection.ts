import amqp, { ConfirmChannel, Connection, Options } from "amqplib";
import { AmqpConnectionOptions, IAmqpConnection } from "../types";
import { ConnectionBase } from "@lindorm-io/core-connection";
import { ConsumeMessage } from "amqplib/properties";
import { LindormError } from "@lindorm-io/errors";
import { merge } from "lodash";
import { parseBlob } from "@lindorm-io/string-blob";

export class AmqpConnection
  extends ConnectionBase<Connection, Options.Connect>
  implements IAmqpConnection
{
  public readonly deadLetters: string;
  public readonly exchange: string;

  private confirmChannel: ConfirmChannel;

  public constructor(options: AmqpConnectionOptions) {
    const { connectInterval, connectTimeout, logger, deadLetters, exchange, ...connectOptions } =
      options;

    super({ connectInterval, connectTimeout, connectOptions, logger });

    this.deadLetters = deadLetters || "deadletters";
    this.exchange = exchange || "exchange";
  }

  // abstract implementation

  protected async createClientConnection(): Promise<Connection> {
    return await amqp.connect(this.connectOptions);
  }

  protected async connectCallback(): Promise<void> {
    this.client.on("error", (err) => this.onError(err));

    this.confirmChannel = await this.client.createConfirmChannel();
    this.confirmChannel.on("return", (msg) => this.onReturn(msg));

    await this.confirmChannel.assertExchange(this.exchange, "topic", { durable: true });
    await this.bindQueue(this.deadLetters, this.deadLetters);
  }

  protected async disconnectCallback(): Promise<void> {
    await this.channel.close();
    await this.client.close();
  }

  // properties

  public get channel(): ConfirmChannel {
    return this.confirmChannel;
  }
  public set channel(_: ConfirmChannel) {
    throw new LindormError("Invalid operation");
  }

  // public

  public async bindQueue(
    queue: string,
    routingKey: string,
    options?: Options.AssertQueue,
  ): Promise<void> {
    await this.confirmChannel.assertQueue(queue, merge({ durable: true }, options));
    await this.confirmChannel.bindQueue(queue, this.exchange, routingKey);

    this.logger.debug("Successfully bound queue", {
      exchange: this.exchange,
      options,
      queue,
      routingKey,
    });
  }

  // private event handlers

  private onReturn(msg: ConsumeMessage): void {
    const message = parseBlob(msg.content.toString());

    this.confirmChannel.publish(
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
