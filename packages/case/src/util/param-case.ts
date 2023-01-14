import { CaseInput } from "../types";
import { convertCase } from "./private";
import { paramCase as _paramCase } from "change-case";

export const paramCase = <T = any>(input: CaseInput): T => convertCase(input, _paramCase);
