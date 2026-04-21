import {
  CreateDateField,
  Entity,
  Field,
  OneToMany,
  PrimaryKeyField,
  Unique,
  UpdateDateField,
  VersionField,
} from "../../src/index.js";
import { Post } from "./Post.js";

@Entity()
export class User {
  @PrimaryKeyField()
  public id!: string;

  @VersionField()
  public version!: number;

  @CreateDateField()
  public createdAt!: Date;

  @UpdateDateField()
  public updatedAt!: Date;

  @Field("string")
  public name!: string;

  @Field("string")
  @Unique()
  public email!: string;

  @OneToMany(() => Post, "author")
  public posts!: Post[];
}
