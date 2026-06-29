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
import type { AggregateIdentifier } from "../../types/aggregate-identifier.js";

@Topic(
  (msg: any) =>
    `queue.aggregate.${msg.aggregate.namespace}.${msg.aggregate.name}.${msg.name}`,
)
@Message({ name: "command" })
export class HermesCommandMessage implements IMessage {
  @IdentifierField()
  @Generated("lindorm_id", { namespace: "cmd" })
  id!: string;

  @MandatoryField()
  mandatory: boolean = true;

  @Field("object")
  aggregate: AggregateIdentifier = { id: "", name: "", namespace: "" };

  @Field("string")
  name: string = "";

  @Field("integer")
  version: number = 1;

  @Field("string")
  causationId: string = "";

  @Nullable()
  @Field("string")
  correlationId: string | null = null;

  @Field("object")
  data: Dict = {};

  @Field("object")
  meta: Dict = {};

  @TimestampField()
  timestamp!: Date;
}
