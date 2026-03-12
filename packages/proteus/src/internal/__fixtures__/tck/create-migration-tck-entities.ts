// Migration TCK Entity Factory
//
// Each call produces fresh class declarations with fresh Symbol.metadata.

import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import {
  CreateDateField,
  Default,
  Entity,
  Field,
  Index,
  ManyToOne,
  Nullable,
  OneToMany,
  PrimaryKeyField,
  Unique,
  UpdateDateField,
  VersionField,
} from "../../../decorators";

export type MigrationTckEntities = {
  TckMigSimple: Constructor<IEntity>;
  TckMigParent: Constructor<IEntity>;
  TckMigChild: Constructor<IEntity>;
  TckMigIndexed: Constructor<IEntity>;
  TckMigExtra: Constructor<IEntity>;
};

export const createMigrationTckEntities = (): MigrationTckEntities => {
  @Entity({ name: "TckMigParent" })
  class TckMigParent {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Index()
    @Field("string")
    label!: string;

    @OneToMany(() => TckMigChild, "parent")
    children!: Array<TckMigChild>;
  }

  @Entity({ name: "TckMigChild" })
  class TckMigChild {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    value!: string;

    @ManyToOne(() => TckMigParent, "children")
    parent!: TckMigParent | null;

    @Nullable()
    @Field("uuid")
    parentId!: string | null;
  }

  @Entity({ name: "TckMigSimple" })
  class TckMigSimple {
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

    @Nullable()
    @Field("string")
    description!: string | null;

    @Default(0)
    @Field("integer")
    score!: number;
  }

  @Entity({ name: "TckMigIndexed" })
  class TckMigIndexed {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Unique()
    @Field("string")
    email!: string;

    @Field("string")
    username!: string;
  }

  @Entity({ name: "TckMigExtra" })
  class TckMigExtra {
    @PrimaryKeyField()
    id!: string;

    @VersionField()
    version!: number;

    @CreateDateField()
    createdAt!: Date;

    @UpdateDateField()
    updatedAt!: Date;

    @Field("string")
    tag!: string;

    @Nullable()
    @Default(false)
    @Field("boolean")
    active!: boolean | null;
  }

  return {
    TckMigSimple: TckMigSimple as unknown as Constructor<IEntity>,
    TckMigParent: TckMigParent as unknown as Constructor<IEntity>,
    TckMigChild: TckMigChild as unknown as Constructor<IEntity>,
    TckMigIndexed: TckMigIndexed as unknown as Constructor<IEntity>,
    TckMigExtra: TckMigExtra as unknown as Constructor<IEntity>,
  };
};
