import { CreateDateColumn, PrimaryColumn } from "typeorm";

export abstract class ViewCausationEntity {
  @PrimaryColumn()
  public view_id: string;

  @PrimaryColumn()
  public view_name: string;

  @PrimaryColumn()
  public view_context: string;

  @PrimaryColumn("uuid")
  public causation_id: string;

  // automatic

  @CreateDateColumn()
  public timestamp: Date;
}
