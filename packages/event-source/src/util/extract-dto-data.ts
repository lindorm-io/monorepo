import { DtoClass } from "../types";
import { snakeCase } from "lodash";

export interface NameData {
  name: string;
  version: number;
}

export interface DtoData {
  name: string;
  version: number;
  data: Record<string, any>;
}

const R_VERSION = /_[vV]/;
const R_VERSION_DIGIT = /_[vV]\d$/;

export const extractNameData = (input: string): NameData => {
  const match = R_VERSION_DIGIT.exec(input);
  const name = match ? snakeCase(input.slice(0, match.index)) : snakeCase(input);
  const version = match ? parseInt(input.slice(match.index).replace(R_VERSION, "")) : 1;

  return { name, version };
};

export const extractDtoData = (dto: DtoClass): DtoData => {
  const { name, version } = extractNameData(dto.constructor.name);
  const { ...data } = dto;
  return { name, version, data };
};
