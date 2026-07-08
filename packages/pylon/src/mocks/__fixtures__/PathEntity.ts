import { Entity, Field, Generated, PrimaryKeyField } from "@lindorm/proteus";

// A real on-disk entity used to prove that createTestPylonCtx resolves entities
// from a directory PATH (the way the generated ProteusSource does), not only
// from class references.
@Entity()
export class PathEntity {
  @PrimaryKeyField()
  @Generated("uuid")
  id!: string;

  @Field("string")
  label!: string;
}
