import { AggregateIdentifier } from "./entity";
import { Data } from "./generic";
import { IMessage as IAmqpMessage } from "@lindorm-io/amqp";

export type MessageBaseType =
  | "command"
  | "domain_event"
  | "error_message"
  | "replay_message"
  | "timeout_message"
  | "unknown";

export interface MessageOptions<TData extends Data = Data> {
  id?: string;
  name: string;
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  data?: TData;
  delay?: number;
  mandatory?: boolean;
  origin?: string;
  originId?: string | null;
  timestamp?: Date;
  version?: number;
}

export interface MessageBaseOptions<TData extends Data = Data> extends MessageOptions<TData> {
  type: MessageBaseType;
}

export interface IMessage extends IAmqpMessage {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
  origin: string;
  originId: string | null;
  version: number;
  type: MessageBaseType;
}
