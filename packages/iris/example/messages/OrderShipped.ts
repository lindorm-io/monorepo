import {
  DeadLetter,
  Field,
  Generated,
  Header,
  IdentifierField,
  Message,
  Namespace,
  Persistent,
  Retry,
  TimestampField,
  Topic,
  Version,
} from "../../src/index.js";

@Message()
@Namespace("orders")
@Topic("order.shipped")
@Version(1)
@Persistent()
@Retry({
  maxRetries: 2,
  strategy: "exponential",
  delay: 200,
  delayMax: 2_000,
  jitter: true,
})
@DeadLetter()
export class OrderShipped {
  @IdentifierField() @Generated() id!: string;
  @TimestampField() createdAt!: Date;

  @Field("string") orderId!: string;
  @Field("string") carrier!: string;
  @Field("date") shippedAt!: Date;

  @Header("x-warehouse") @Field("string") warehouse!: string;
}
