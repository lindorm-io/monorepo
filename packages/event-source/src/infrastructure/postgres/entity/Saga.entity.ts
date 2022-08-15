import { IMessage } from "../../../types";
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
@Index(["id", "name", "context", "revision"], { unique: true })
export class SagaEntity {
  @PrimaryColumn()
  public id: string;

  @PrimaryColumn()
  public name: string;

  @PrimaryColumn()
  public context: string;

  @Column("boolean")
  public destroyed: boolean;

  @Column("jsonb")
  public messages_to_dispatch: Array<IMessage>;

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
