import { Column, Index } from "@lindorm/entity";
import { File, MongoFileBase } from "@lindorm/mongo";

@File()
export class TestUploadTwo extends MongoFileBase {
  @Column("string")
  @Index()
  public name!: string;
}
