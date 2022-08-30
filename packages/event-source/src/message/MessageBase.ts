import { MessageType } from "../enum";
import { randomUUID } from "crypto";
import {
  AggregateIdentifier,
  Data,
  IMessage,
  MessageBaseOptions,
  MessageBaseType,
  Metadata,
} from "../types";

export abstract class MessageBase<TData extends Data = Data, TMetadata extends Metadata = Metadata>
  implements IMessage
{
  public readonly id: string;
  public readonly aggregate: AggregateIdentifier;
  public readonly causationId: string;
  public readonly correlationId: string;
  public readonly data: TData;
  public readonly delay: number;
  public readonly mandatory: boolean;
  public readonly metadata: TMetadata;
  public readonly name: string;
  public readonly timestamp: Date;
  public readonly type: MessageBaseType;
  public readonly version: number;

  protected constructor(options: MessageBaseOptions<TData, TMetadata>, causation?: IMessage) {
    this.id = options.id || randomUUID();
    this.aggregate = options.aggregate;
    this.causationId = options.causationId || causation?.id || this.id;
    this.correlationId = options.correlationId || causation?.correlationId || randomUUID();
    this.data = options.data || ({} as unknown as TData);
    this.delay = options.delay || 0;
    this.mandatory = options.mandatory || false;
    this.metadata = options.metadata || ({} as unknown as TMetadata);
    this.name = options.name;
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
