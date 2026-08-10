import { input } from "@inquirer/prompts";

export type TrimmedInputSettings = {
  message: string;
  default: string;
  validate: (value: string) => true | string;
};

/**
 * A free-text prompt whose answer is normalised ONCE, here at the boundary.
 *
 * `@inquirer/prompts` hands back the raw keystrokes (`value || defaultValue` —
 * it never trims), so a prompt that validates `value.trim()` validates one
 * string and returns another: a pasted `"  https://auth.example.com  "` passes
 * validation and is then scaffolded with its whitespace intact. Trimming here
 * means the string that is validated IS the string that is returned, rather
 * than every consumer downstream having to remember to trim.
 *
 * Trimming rather than rejecting is deliberate: a trailing space on a pasted
 * URL is not a mistake worth a re-prompt. Whitespace INSIDE the value still
 * fails, because the validators reject it.
 */
export const promptTrimmedInput = async (
  settings: TrimmedInputSettings,
): Promise<string> => {
  const answer = await input({
    message: settings.message,
    default: settings.default,
    validate: (value) => settings.validate(value.trim()),
  });

  return answer.trim();
};
