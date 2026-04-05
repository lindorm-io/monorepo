import { Default, Entity, Field, Namespace } from "@lindorm/proteus";
import { HermesViewEntity } from "../../../entities/HermesViewEntity";

@Namespace("test")
@Entity({ name: "test_view" })
export class TestViewEntity extends HermesViewEntity {
  @Field("string")
  @Default("")
  public create: string = "";

  @Field("string")
  @Default("")
  public mergeState: string = "";

  @Field("string")
  @Default("")
  public setState: string = "";

  @Field("string")
  @Default("")
  public destroy: string = "";
}
