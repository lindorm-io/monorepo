export type GenerateEntityOptions = {
  name: string;
};

export const generateEntitySource = (options: GenerateEntityOptions): string => {
  const { name } = options;

  return [
    `import { Entity, Field, PrimaryKey } from "@lindorm/proteus";`,
    ``,
    `@Entity()`,
    `export class ${name} {`,
    `  @PrimaryKey()`,
    `  @Field("uuid")`,
    `  id!: string;`,
    ``,
    `  @Field("date")`,
    `  createdAt!: Date;`,
    ``,
    `  @Field("date")`,
    `  updatedAt!: Date;`,
    `}`,
    ``,
  ].join("\n");
};

export const PROTEUS_ENTITY_NAME_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;
