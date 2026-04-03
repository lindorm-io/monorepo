import { CorrelationField, Field, Message, Namespace, Topic } from "@lindorm/iris";
import { Dict } from "@lindorm/types";

@Namespace("pylon")
@Message()
@Topic(() => "pylon.queue.job")
export class PylonJob {
  @CorrelationField()
  public readonly correlationId!: string;

  @Field("string")
  public readonly event!: string;

  @Field("object")
  public readonly payload!: Dict;
}
