import { Field, Message, Namespace } from "../../src/index.js";

@Message()
@Namespace("pricing")
export class PriceResponse {
  @Field("float") price!: number;
  @Field("string") currency!: string;
}
