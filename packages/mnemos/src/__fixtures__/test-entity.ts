import {
  Column,
  DeleteDateColumn,
  Entity,
  EntityBase,
  ExpiryDateColumn,
  Generated,
  PrimarySource,
  UpdateDateColumn,
  VersionColumn,
} from "@lindorm/entity";

export type TestEntityOptions = {
  expiresAt?: Date;
  email?: string | null;
  name?: string;
};

@Entity()
@PrimarySource("mnemos")
export class TestEntity extends EntityBase {
  @DeleteDateColumn()
  public readonly deletedAt!: Date | null;

  @ExpiryDateColumn()
  public expiresAt!: Date | null;

  @UpdateDateColumn()
  public readonly updatedAt!: Date;

  @VersionColumn()
  public readonly version!: number;

  @Column()
  @Generated("increment")
  public readonly sequence!: number;

  @Column()
  public email!: string | null;

  @Column()
  public name!: string;
}
