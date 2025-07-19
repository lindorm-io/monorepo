import {
  Column,
  Entity,
  EntityBase,
  OnValidate,
  PrimarySource,
  UpdateDateColumn,
  VersionColumn,
} from "@lindorm/entity";

export type TestEntityOneOptions = {
  email?: string;
  name: string;
};

@Entity()
@OnValidate((entity: TestEntityOne) => {
  if (entity.name.length < 3) {
    throw new Error("Name must be at least 3 characters long");
  }
})
@PrimarySource("MongoSource")
export class TestEntityOne extends EntityBase {
  @VersionColumn()
  public version!: number;

  @UpdateDateColumn()
  public updatedAt!: Date;

  @Column("string", { nullable: true })
  public email!: string | null;

  @Column("string")
  public name!: string;
}
