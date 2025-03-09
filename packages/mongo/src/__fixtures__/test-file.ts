import { Column, Index } from "@lindorm/entity";
import { MongoFileBase } from "../classes";
import { File } from "../decorators";

export type TestFileOptions = {
  name?: string | null;
};

@File()
export class TestFile extends MongoFileBase {
  @Column("string", { nullable: true })
  @Index()
  public readonly name!: string | null;

  @Column("integer", { nullable: true })
  public readonly extraOne!: number | null;

  @Column("integer", { nullable: true })
  public readonly extraTwo!: number | null;
}
