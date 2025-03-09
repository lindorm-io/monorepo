import { Column, Entity, PrimarySource, VersionedEntityBase } from "@lindorm/entity";

@Entity()
@PrimarySource("redis")
export class TestEntityTwo extends VersionedEntityBase {
  @Column("string")
  public name!: string;
}
