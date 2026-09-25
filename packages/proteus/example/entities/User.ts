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
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Field("string")
  @Unique()
  email!: string;

  @OneToMany(() => Post, "author")
  posts!: Post[];
}
