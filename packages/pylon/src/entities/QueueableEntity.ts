import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryKeyColumn,
  UpdateDateColumn,
  VersionColumn,
} from "@lindorm/entity";
import { IQueueableEntity } from "../interfaces/QueueableEntity";

export abstract class QueueableEntity implements IQueueableEntity {
  @PrimaryKeyColumn()
  public readonly id!: string;

  @VersionColumn()
  public readonly version!: number;

  @CreateDateColumn()
  public readonly createdAt!: Date;

  @UpdateDateColumn()
  public readonly updatedAt!: Date;

  @Index()
  @Column("date", { nullable: true })
  public readonly acknowledgedAt!: Date | null;

  @Index()
  @Column("date", { nullable: true })
  public readonly failedAt!: Date | null;

  @Column("integer", { fallback: 1 })
  public readonly priority!: number;
}
