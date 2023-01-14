import { CaseInput } from "../types";
import { convertCase } from "./private";
import { dotCase as _dotCase } from "change-case";

export const dotCase = <T = any>(input: CaseInput): T => convertCase(input, _dotCase);
