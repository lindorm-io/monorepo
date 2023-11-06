import { snakeCase as fn } from "change-case";
import { CaseInput } from "../types";
import { convertCase } from "./private";

export const snakeCase = <T = any>(input: CaseInput): T => convertCase(input, fn);
