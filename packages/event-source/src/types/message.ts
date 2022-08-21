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

export interface MessageOptions<D extends Data = Data> {
  id?: string;
  name: string;
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  data?: D;
  delay?: number;
  mandatory?: boolean;
  origin?: string;
  originator?: string | null;
  timestamp?: Date;
  version?: number;
}

export interface MessageBaseOptions<D extends Data = Data> extends MessageOptions<D> {
  type: MessageBaseType;
}

export interface IMessage extends IAmqpMessage {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
  origin: string;
  originator: string | null;
  version: number;
  type: MessageBaseType;
}
