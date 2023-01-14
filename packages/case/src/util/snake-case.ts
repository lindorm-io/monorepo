import { CaseInput } from "../types";
import { convertCase } from "./private";
import { snakeCase as _snakeCase } from "change-case";

export const snakeCase = <T = any>(input: CaseInput): T => convertCase(input, _snakeCase);
