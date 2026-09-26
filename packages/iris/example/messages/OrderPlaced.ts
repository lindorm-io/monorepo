import {
  CorrelationField,
  Default,
  Field,
  Generated,
  IdentifierField,
  Message,
  Namespace,
  Nullable,
  Optional,
  TimestampField,
  Version,
} from "../../src/index.js";

@Message()
@Namespace("orders")
@Version(1)
export class OrderPlaced {
  @IdentifierField() @Generated() id!: string;
  @CorrelationField() @Generated() correlationId!: string;
  @TimestampField() createdAt!: Date;

  @Field("string") orderId!: string;
  @Field("email") customerEmail!: string;
  @Field("float") total!: number;
  @Field("integer") lineCount!: number;
  @Field("array") skus!: Array<string>;
  @Field("object") attributes!: Record<string, unknown>;

  @Default("EUR") @Field("string") currency!: string;
  @Nullable() @Field("string") couponCode!: string | null;
  @Optional() @Field("url") callbackUrl?: string;
}
