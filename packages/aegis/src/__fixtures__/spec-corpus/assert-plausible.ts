import { SpecCorpusError } from "./SpecCorpusError.js";

export const MIN_EXTRACT_CHARS = 120;
export const MIN_EXTRACT_LINES = 3;

/**
 * The floor that stops a verifier reporting green because it extracted nothing.
 * Enforced when an extract is written AND every time one is read, so a truncated
 * committed file cannot pass either.
 */
export const assertPlausible = (key: string, body: string): void => {
  const lines = body.split("\n").filter((line) => line.trim().length > 0).length;

  if (body.length >= MIN_EXTRACT_CHARS && lines >= MIN_EXTRACT_LINES) {
    return;
  }

  throw new SpecCorpusError(`Implausible extract for ${key}`, {
    code: "extract_implausible",
    data: { key, chars: body.length, lines },
    debug: { body },
    title: "Spec Corpus Implausible Extract",
    details: `An extract must hold at least ${MIN_EXTRACT_CHARS} characters and ${MIN_EXTRACT_LINES} non-blank lines; a shorter one means the extraction found the heading but not the section.`,
  });
};
