import {
  Field,
  Generated,
  IdentifierField,
  MandatoryField,
  Message,
  TimestampField,
  Topic,
} from "@lindorm/iris";
import type { IMessage } from "@lindorm/iris";
import type { Dict } from "@lindorm/types";
import type { AggregateIdentifier } from "../../types/aggregate-identifier";

@Topic((msg: any) => `${msg.aggregate.namespace}.${msg.aggregate.name}.${msg.name}`)
@Message({ name: "event" })
export class HermesEventMessage implements IMessage {
  @IdentifierField()
  @Generated("uuid")
  public id!: string;

  @MandatoryField()
  public mandatory: boolean = false;

  @Field("jsonb")
  public aggregate: AggregateIdentifier = { id: "", name: "", namespace: "" };

  @Field("string")
  public name: string = "";

  @Field("integer")
  public version: number = 1;

  @Field("string")
  public causationId: string = "";

  @Field("string", { nullable: true })
  public correlationId: string | null = null;

  @Field("jsonb")
  public data: Dict = {};

  @Field("jsonb")
  public meta: Dict = {};

  @TimestampField()
  public timestamp!: Date;
}
