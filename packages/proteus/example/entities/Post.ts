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
  public id!: string;

  @CreateDateField()
  public createdAt!: Date;

  @Field("string")
  public title!: string;

  @Field("text")
  public content!: string;

  @ManyToOne(() => User, "posts")
  public author!: User | null;

  public authorId!: string | null;
}
