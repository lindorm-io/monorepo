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
  public id: string = "";

  @Field("boolean")
  @Default(false)
  public destroyed: boolean = false;

  @VersionField()
  public revision: number = 0;

  @CreateDateField()
  public createdAt: Date = new Date();

  @UpdateDateField()
  public updatedAt: Date = new Date();
}
