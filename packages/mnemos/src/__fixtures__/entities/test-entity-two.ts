import { Column, Entity, VersionedEntityBase } from "@lindorm/entity";

@Entity()
export class TestEntityTwo extends VersionedEntityBase {
  @Column("string")
  public readonly name!: string;
}
