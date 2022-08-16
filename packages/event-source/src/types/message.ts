import { AggregateIdentifier } from "./model";
import { Data } from "./generic";
import { IMessage as IMessageBase } from "@lindorm-io/amqp";

export interface MessageOptions<D extends Data = Data> {
  id?: string;
  aggregate: AggregateIdentifier;
  causationId?: string;
  correlationId?: string;
  data?: D;
  delay?: number;
  mandatory?: boolean;
  name: string;
  origin?: string;
  originator?: string | null;
  timestamp?: Date;
  type?: string;
  version?: number;
}

export interface IMessage extends IMessageBase {
  aggregate: AggregateIdentifier;
  causationId: string;
  correlationId: string;
  origin: string;
  originator: string | null;
  version: number;
}
