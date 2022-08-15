import { AggregateIdentifier, Data, IMessage, MessageOptions } from "../types";
import { MessageType } from "../enum";
import { randomUUID } from "crypto";

export abstract class Message<D extends Data = Data> implements IMessage {
  public readonly id: string;
  public readonly name: string;
  public readonly data: D;
  public readonly aggregate: AggregateIdentifier;
  public readonly causationId: string;
  public readonly correlationId: string;
  public readonly delay: number;
  public readonly mandatory: boolean;
  public readonly origin: string;
  public readonly originator: string | null;
  public readonly timestamp: Date;
  public readonly type: string;

  protected constructor(options: MessageOptions<D>, causation?: Message) {
    this.id = options.id || randomUUID();
    this.name = options.name;
    this.data = options.data || ({} as unknown as D);
    this.aggregate = options.aggregate;
    this.causationId = options.causationId || causation?.id || this.id;
    this.correlationId = options.correlationId || causation?.correlationId || randomUUID();
    this.delay = options.delay || 0;
    this.mandatory = options.mandatory || false;
    this.origin = options.origin;
    this.originator = options.originator || null;
    this.timestamp = options.timestamp ? new Date(options.timestamp) : new Date();
    this.type = options.type || MessageType.UNKNOWN;
  }

  public get topic(): string {
    return `${this.aggregate.context}.${this.aggregate.name}.${this.name}`;
  }
  public set topic(_: string) {
    /* ignored */
  }
}
