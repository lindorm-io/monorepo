import { CorrelationField, Field, Message, Namespace, Topic } from "@lindorm/iris";
import type { Dict } from "@lindorm/types";

@Namespace("pylon")
@Message()
@Topic(() => "pylon.queue.job")
export class Job {
  @CorrelationField()
  readonly correlationId!: string;

  @Field("string")
  readonly event!: string;

  @Field("object")
  readonly payload!: Dict;
}
