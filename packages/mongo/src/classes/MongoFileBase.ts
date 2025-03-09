import { Column, CreateDateColumn, Index, PrimaryKeyColumn } from "@lindorm/entity";
import { IMongoFile } from "../interfaces";

export class MongoFileBase implements IMongoFile {
  // File Data

  @PrimaryKeyColumn()
  public readonly filename!: string;

  @CreateDateColumn()
  public readonly uploadDate!: Date;

  @Column("integer", { fallback: 0 })
  public readonly chunkSize!: number;

  @Column("integer", { fallback: 0 })
  public readonly length!: number;

  // Standard Metadata

  @Column("string", { nullable: true })
  @Index()
  public readonly mimeType!: string | null;

  @Column("string", { nullable: true })
  @Index()
  public readonly originalName!: string | null;

  @Column("string", { nullable: true })
  public readonly encoding!: string | null;

  @Column("string", { nullable: true })
  public readonly hash!: string | null;

  @Column("string", { nullable: true })
  public readonly hashAlgorithm!: string | null;

  @Column("integer", { min: 0, nullable: true })
  public readonly size!: number | null;

  @Column("string", { nullable: true })
  public readonly strategy!: string | null;
}
