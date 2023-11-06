import { capitalCase as fn } from "change-case";
import { CaseInput } from "../types";
import { convertCase } from "./private";

export const capitalCase = <T = any>(input: CaseInput): T => convertCase(input, fn);
