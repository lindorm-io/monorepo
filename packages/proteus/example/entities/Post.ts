import {
  CreateDateField,
  Entity,
  Field,
  ManyToOne,
  PrimaryKeyField,
} from "../../src/index.js";
import { User } from "./User.js";

@Entity()
export class Post {
  @PrimaryKeyField()
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @Field("string")
  title!: string;

  @Field("text")
  content!: string;

  @ManyToOne(() => User, "posts")
  author!: User | null;

  authorId!: string | null;
}
