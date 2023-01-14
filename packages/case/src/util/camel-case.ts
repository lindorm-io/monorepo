import { CaseInput } from "../types";
import { convertCase } from "./private";
import { camelCase as _camelCase } from "change-case";

export const camelCase = <T = any>(input: CaseInput): T => convertCase(input, _camelCase);
