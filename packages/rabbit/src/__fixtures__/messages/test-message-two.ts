import { Field, Message, MessageBase } from "@lindorm/message";

@Message()
export class TestMessageTwo extends MessageBase {
  @Field("string")
  public readonly name!: string;
}
