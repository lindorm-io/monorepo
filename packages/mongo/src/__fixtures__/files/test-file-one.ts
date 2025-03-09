import { Column, Index } from "@lindorm/entity";
import { MongoFileBase } from "../../classes";
import { File } from "../../decorators";

@File()
export class TestFileOne extends MongoFileBase {
  @Column("string")
  @Index()
  public name!: string;
}
