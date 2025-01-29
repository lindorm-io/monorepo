import { EntityBase } from "@lindorm/entity";
import { IMnemosEntity } from "../interfaces";
import { MnemosEntityConfig } from "../types";

export class MnemosEntity extends EntityBase implements IMnemosEntity {
  public expiresAt!: Date | null;
}

export const MNEMOS_ENTITY_CONFIG: MnemosEntityConfig<MnemosEntity> = {
  ttlAttribute: "expiresAt",
};
