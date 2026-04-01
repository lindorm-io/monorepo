import type { ClassLike, Dict } from "@lindorm/types";
import { extractNameData, getHermesMetadata } from "#internal/metadata";

export type DtoData = {
  name: string;
  version: number;
  data: Dict;
};

export const extractDto = (dto: ClassLike): DtoData => {
  const meta = getHermesMetadata(dto.constructor);

  const { name, version } = meta.dto
    ? { name: meta.dto.name, version: meta.dto.version }
    : extractNameData(dto.constructor.name);

  const { ...data } = dto;
  return { name, version, data };
};
