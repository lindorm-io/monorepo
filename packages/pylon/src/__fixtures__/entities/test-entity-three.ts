import {
  Column,
  Entity,
  EntityBase,
  PrimarySource,
  ScopeColumn,
  UpdateDateColumn,
  VersionColumn,
} from "@lindorm/entity";

export type TestEntityThreeOptions = {
  expiresAt?: Date;
  email?: string | null;
  name?: string;
  scope?: string;
};

@Entity()
@PrimarySource("RedisSource")
export class TestEntityThree extends EntityBase {
  @UpdateDateColumn()
  public readonly updatedAt!: Date;

  @VersionColumn()
  public readonly version!: number;

  @Column()
  public email!: string | null;

  @Column()
  public name!: string;

  @ScopeColumn()
  public scope!: string;
}
