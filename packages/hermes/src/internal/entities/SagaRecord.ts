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
  id: string = "";

  @PrimaryKey()
  @Field("string")
  name: string = "";

  @PrimaryKey()
  @Field("string")
  namespace: string = "";

  @Field("boolean")
  @Default(false)
  destroyed: boolean = false;

  @Field("array")
  @Default(() => [])
  messagesToDispatch: Array<unknown> = [];

  @Field("json")
  @Default(() => ({}))
  state: Record<string, unknown> = {};

  @VersionField()
  revision: number = 0;

  @CreateDateField()
  createdAt: Date = new Date();

  @UpdateDateField()
  updatedAt: Date = new Date();
}
