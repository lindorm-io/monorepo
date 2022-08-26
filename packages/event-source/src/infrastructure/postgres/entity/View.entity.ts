import { Column, CreateDateColumn, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";
import { ViewStoreAttributes } from "../../../types";

export abstract class ViewEntity implements ViewStoreAttributes {
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

  @Column("timestamp", { nullable: true })
  public modified: Date;

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
