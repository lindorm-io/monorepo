import { AggregateIdentifier } from "./aggregate";
import { Data } from "./generic";
import { IMessage as IMessageBase } from "@lindorm-io/amqp";

export interface MessageOptions<D extends Data = Data> {
  id?: string;
  name: string;
  data?: D;
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  delay?: number;
  mandatory?: boolean;
  timestamp?: Date;
  type?: string;
}

export interface IMessage extends IMessageBase {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
}
