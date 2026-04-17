import {
  Field,
  Generated,
  IdentifierField,
  MandatoryField,
  Message,
  Nullable,
  TimestampField,
  Topic,
} from "@lindorm/iris";
import type { IMessage } from "@lindorm/iris";
import type { Dict } from "@lindorm/types";
import type { AggregateIdentifier } from "../../types/aggregate-identifier";

@Topic(
  (msg: any) =>
    `queue.saga.timeout.${msg.aggregate.namespace}.${msg.aggregate.name}.${msg.name}`,
)
@Message({ name: "timeout" })
export class HermesTimeoutMessage implements IMessage {
  @IdentifierField()
  @Generated("uuid")
  public id!: string;

  @MandatoryField()
  public mandatory: boolean = true;

  @Field("object")
  public aggregate: AggregateIdentifier = { id: "", name: "", namespace: "" };

  @Field("string")
  public name: string = "";

  @Field("integer")
  public version: number = 1;

  @Field("string")
  public causationId: string = "";

  @Nullable()
  @Field("string")
  public correlationId: string | null = null;

  @Field("object")
  public data: Dict = {};

  @Field("object")
  public meta: Dict = {};

  @TimestampField()
  public timestamp!: Date;
}
