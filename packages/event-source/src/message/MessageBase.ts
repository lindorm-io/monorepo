import { AggregateIdentifier, Data, IMessage, MessageBaseOptions, MessageBaseType } from "../types";
import { MessageType } from "../enum";
import { randomUUID } from "crypto";

export abstract class MessageBase<D extends Data = Data> implements IMessage {
  public readonly id: string;
  public readonly aggregate: AggregateIdentifier;
  public readonly causationId: string;
  public readonly correlationId: string;
  public readonly data: D;
  public readonly delay: number;
  public readonly mandatory: boolean;
  public readonly name: string;
  public readonly origin: string;
  public readonly originator: string | null;
  public readonly timestamp: Date;
  public readonly type: MessageBaseType;
  public readonly version: number;

  protected constructor(options: MessageBaseOptions<D>, causation?: IMessage) {
    this.id = options.id || randomUUID();
    this.aggregate = options.aggregate;
    this.causationId = options.causationId || causation?.id || this.id;
    this.correlationId = options.correlationId || causation?.correlationId || randomUUID();
    this.data = options.data || ({} as unknown as D);
    this.delay = options.delay || 0;
    this.mandatory = options.mandatory || false;
    this.name = options.name;
    this.origin = options.origin || "unknown";
    this.originator = options.originator || null;
    this.timestamp = options.timestamp ? new Date(options.timestamp) : new Date();
    this.type = options.type || MessageType.UNKNOWN;
    this.version = options.version || 1;
  }

  public get topic(): string {
    return `${this.aggregate.context}.${this.aggregate.name}.${this.name}`;
  }
  public set topic(_: string) {
    /* ignored */
  }
}
