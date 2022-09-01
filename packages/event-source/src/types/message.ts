import { AggregateIdentifier } from "./model";
import { Data, Metadata } from "./generic";
import { IMessage as IAmqpMessage } from "@lindorm-io/amqp";

export type MessageBaseType =
  | "command"
  | "domain_event"
  | "error_message"
  | "replay_message"
  | "timeout_message"
  | "unknown";

export interface MessageOptions<TData extends Data = Data, TMetadata extends Metadata = Metadata> {
  id?: string;
  name: string;
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  data?: TData;
  delay?: number;
  mandatory?: boolean;
  metadata?: TMetadata;
  timestamp?: Date;
  version?: number;
}

export interface MessageBaseOptions<
  TData extends Data = Data,
  TMetadata extends Metadata = Metadata,
> extends MessageOptions<TData, TMetadata> {
  type: MessageBaseType;
}

export interface IMessage<TData = any> extends IAmqpMessage<TData> {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
  metadata: Record<string, any>;
  type: MessageBaseType;
  version: number;
}
