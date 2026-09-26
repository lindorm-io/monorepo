import { Field, Message, Namespace } from "../../src/index.js";

@Message()
@Namespace("pricing")
export class PriceRequest {
  @Field("string") sku!: string;
}
