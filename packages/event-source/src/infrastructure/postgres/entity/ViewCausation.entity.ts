import { CreateDateColumn, Entity, Index, PrimaryColumn } from "typeorm";
import { ViewStoreCausationAttributes } from "../../../types";

@Entity({ name: "view_causation" })
@Index(["view_id", "view_name", "view_context"])
@Index(["view_id", "view_name", "view_context", "causation_id"], {
  unique: true,
})
export class ViewCausationEntity implements ViewStoreCausationAttributes {
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
