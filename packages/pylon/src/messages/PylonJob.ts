import { Field, Message, MessageBase, PriorityField, Topic } from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { QUEUE_JOB_TOPIC } from "../constants/private";
import { IJob } from "../interfaces";

@Message()
@Topic((_) => QUEUE_JOB_TOPIC)
export class PylonJob extends MessageBase implements IJob {
  @Field("string")
  public readonly event!: string;

  @Field("object")
  public readonly payload!: Dict;

  @PriorityField()
  public readonly priority!: number;
}
