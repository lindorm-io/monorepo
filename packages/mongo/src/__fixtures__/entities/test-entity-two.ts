import { Column, Entity, PrimarySource, VersionedEntityBase } from "@lindorm/entity";

@Entity()
@PrimarySource("MongoSource")
export class TestEntityTwo extends VersionedEntityBase {
  @Column("string")
  public name!: string;
}
