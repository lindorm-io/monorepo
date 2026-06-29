import {
  Field,
  Generated,
  IdentifierField,
  MandatoryField,
  Message,
  Nullable,
  TimestampField,
} from "@lindorm/iris";
import type { IMessage } from "@lindorm/iris";
import type { Dict } from "@lindorm/types";
import type { AggregateIdentifier } from "../../types/aggregate-identifier.js";

@Message({ name: "error" })
export class HermesErrorMessage implements IMessage {
  @IdentifierField()
  @Generated("lindorm_id", { namespace: "err" })
  id!: string;

  @MandatoryField()
  mandatory: boolean = false;

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
