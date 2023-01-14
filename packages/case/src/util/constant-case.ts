import { CaseInput } from "../types";
import { convertCase } from "./private";
import { constantCase as _constantCase } from "change-case";

export const constantCase = <T = any>(input: CaseInput): T => convertCase(input, _constantCase);
