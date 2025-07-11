import { Field, Message, MessageBase, Topic } from "@lindorm/message";

@Message()
@Topic((message) => `decorated.topic.${message.topic}`)
export class TestMessageThree extends MessageBase {
  @Field("string")
  public readonly input!: string;

  @Field("string")
  public readonly topic!: string;
}
