import { AggregateIdentifier } from "./aggregate";
import { IMessage as IMessageBase } from "@lindorm-io/amqp";

export interface IMessage extends IMessageBase {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
}

export interface MessageOptions {
  id?: string;
  name: string;
  data?: Record<string, any>;
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  delay?: number;
  mandatory?: boolean;
  timestamp?: Date;
  type?: string;
}
