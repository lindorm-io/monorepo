import { Column, Index } from "@lindorm/entity";
import { File, MongoFileBase } from "@lindorm/mongo";

@File()
export class TestUploadOne extends MongoFileBase {
  @Column("string", { nullable: true })
  @Index()
  public readonly name!: string | null;

  @Column("integer", { nullable: true })
  public readonly extraOne!: number | null;

  @Column("integer", { nullable: true })
  public readonly extraTwo!: number | null;
}
