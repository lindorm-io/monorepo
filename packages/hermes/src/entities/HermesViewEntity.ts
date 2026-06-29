import {
  AbstractEntity,
  CreateDateField,
  Default,
  Field,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";

@AbstractEntity()
export abstract class HermesViewEntity {
  @PrimaryKeyField()
  id: string = "";

  @Field("boolean")
  @Default(false)
  destroyed: boolean = false;

  @VersionField()
  revision: number = 0;

  @CreateDateField()
  createdAt: Date = new Date();

  @UpdateDateField()
  updatedAt: Date = new Date();
}
