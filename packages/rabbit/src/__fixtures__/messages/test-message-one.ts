import { Field, Message, MessageBase } from "@lindorm/message";
import { Dict } from "@lindorm/types";

@Message({ topic: "test.message.one.override" })
export class TestMessageOne extends MessageBase {
  @Field("object")
  public readonly data!: Dict;

  @Field("object")
  public readonly meta!: Dict;
}
