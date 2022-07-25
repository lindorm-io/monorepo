import { AggregateIdentifier, IMessage, MessageOptions } from "../types";
import { MessageType } from "../enum";
import { randomUUID } from "crypto";

export abstract class Message implements IMessage {
  public readonly id: string;
  public readonly name: string;
  public readonly aggregate: AggregateIdentifier;
  public readonly causationId: string;
  public readonly correlationId: string;
  public readonly data: Record<string, any>;
  public readonly delay: number;
  public readonly mandatory: boolean;
  public readonly timestamp: Date;
  public readonly type: string;

  protected constructor(options: MessageOptions, causation?: IMessage) {
    this.id = options.id || randomUUID();
    this.name = options.name;
    this.aggregate = options.aggregate;
    this.causationId = options.causationId || causation?.id || this.id;
    this.correlationId = options.correlationId || causation?.correlationId || randomUUID();
    this.data = options.data || {};
    this.delay = options.delay || 0;
    this.mandatory = options.mandatory || false;
    this.timestamp = options.timestamp || new Date();
    this.type = options.type || MessageType.UNKNOWN;
  }

  public get routingKey(): string {
    return `${this.aggregate.context}.${this.aggregate.name}.${this.name}`;
  }

  public set routingKey(_: string) {
    /* ignored */
  }
}
