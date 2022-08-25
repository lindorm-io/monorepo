import { DtoClass } from "../types";
import { snakeCase } from "lodash";

export interface DtoData {
  name: string;
  version: number;
  data: Record<string, any>;
}

const R_VERSION = /_[vV]/;
const R_VERSION_DIGIT = /_[vV]\d$/;

export const extractDtoData = (dto: DtoClass): DtoData => {
  const match = R_VERSION_DIGIT.exec(dto.constructor.name);

  const name = match
    ? snakeCase(dto.constructor.name.slice(0, match.index))
    : snakeCase(dto.constructor.name);

  const version = match
    ? parseInt(dto.constructor.name.slice(match.index).replace(R_VERSION, ""))
    : 1;

  const { ...data } = dto;

  return { name, version, data };
};
