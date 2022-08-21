import { IMessage, SagaStoreAttributes } from "../../../types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from "typeorm";

@Entity({ name: "saga" })
@Index(["id", "name", "context"], { unique: true })
@Index(["id", "name", "context", "hash", "revision"], { unique: true })
export class SagaEntity implements SagaStoreAttributes {
  @PrimaryColumn()
  public id: string;

  @PrimaryColumn()
  public name: string;

  @PrimaryColumn()
  public context: string;

  @Column("boolean")
  public destroyed: boolean;

  @Column()
  public hash: string;

  @Column("jsonb")
  public messages_to_dispatch: Array<IMessage>;

  @Column("jsonb")
  public processed_causation_ids: Array<string>;

  @Column("jsonb")
  public state: Record<string, any>;

  // automatic

  @VersionColumn()
  public revision: number;

  @CreateDateColumn()
  public created_at: Date;

  @UpdateDateColumn()
  public updated_at: Date;
}
