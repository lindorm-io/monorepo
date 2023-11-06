import { pascalCase as fn } from "change-case";
import { CaseInput } from "../types";
import { convertCase } from "./private";

export const pascalCase = <T = any>(input: CaseInput): T => convertCase(input, fn);
