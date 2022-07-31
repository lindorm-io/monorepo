import { Column, CreateDateColumn, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";

export abstract class ViewEntity {
  @PrimaryColumn()
  public id: string;

  @PrimaryColumn()
  public name: string;

  @PrimaryColumn()
  public context: string;

  @Column("boolean")
  public destroyed: boolean;

  @Column("jsonb")
  public meta: Record<string, any>;

  @Column("jsonb")
  public state: Record<string, any>;

  // automatic

  @VersionColumn()
  public revision: number;

  @CreateDateColumn()
  public timestamp: Date;

  @UpdateDateColumn()
  public timestamp_modified: Date;
}
