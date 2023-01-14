import { CaseInput } from "../types";
import { convertCase } from "./private";
import { pascalCase as _pascalCase } from "change-case";

export const pascalCase = <T = any>(input: CaseInput): T => convertCase(input, _pascalCase);
