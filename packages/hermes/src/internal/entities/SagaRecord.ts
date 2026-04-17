import {
  CreateDateField,
  Default,
  Entity,
  Field,
  Namespace,
  PrimaryKey,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";

@Namespace("hermes")
@Entity({ name: "saga" })
export class SagaRecord {
  @PrimaryKey()
  @Field("string")
  public id: string = "";

  @PrimaryKey()
  @Field("string")
  public name: string = "";

  @PrimaryKey()
  @Field("string")
  public namespace: string = "";

  @Field("boolean")
  @Default(false)
  public destroyed: boolean = false;

  @Field("array")
  @Default(() => [])
  public messagesToDispatch: Array<unknown> = [];

  @Field("json")
  @Default(() => ({}))
  public state: Record<string, unknown> = {};

  @VersionField()
  public revision: number = 0;

  @CreateDateField()
  public createdAt: Date = new Date();

  @UpdateDateField()
  public updatedAt: Date = new Date();
}
