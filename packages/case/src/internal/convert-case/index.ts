// Regexps involved with splitting words in various case formats.
const SPLIT_LOWER_UPPER_RE = /([\p{Ll}\d])(\p{Lu})/gu;
const SPLIT_UPPER_UPPER_RE = /(\p{Lu})([\p{Lu}][\p{Ll}])/gu;

// Used to iterate over the initial split result and separate numbers.
const SPLIT_SEPARATE_NUMBER_RE = /(\d)\p{Ll}|(\p{L})\d/u;

// Regexp involved with stripping non-word characters from the result.
const DEFAULT_STRIP_REGEXP = /[^\p{L}\d]+/giu;

// The replacement value for splits.
const SPLIT_REPLACE_VALUE = "$1\0$2";

// The default characters to keep after transforming case.
const DEFAULT_PREFIX_SUFFIX_CHARACTERS = "";

/**
 * Supported locale values. Use `false` to ignore locale.
 * Defaults to `undefined`, which uses the host environment.
 */
export type Locale = string[] | string | false | undefined;

/**
 * Options used for converting strings to any case.
 */
export type CaseOptions = {
  locale?: Locale;
  split?: (value: string) => string[];
  separateNumbers?: boolean;
  delimiter?: string;
  prefixCharacters?: string;
  suffixCharacters?: string;
};

/**
 * Options used for converting strings to pascal/camel case.
 */
export type PascalCaseOptions = CaseOptions & {
  mergeAmbiguousCharacters?: boolean;
};

/**
 * Split any cased input strings into an array of words.
 */
export const split = (value: string): Array<string> => {
  let result = value.trim();

  result = result
    .replace(SPLIT_LOWER_UPPER_RE, SPLIT_REPLACE_VALUE)
    .replace(SPLIT_UPPER_UPPER_RE, SPLIT_REPLACE_VALUE);

  result = result.replace(DEFAULT_STRIP_REGEXP, "\0");

  let start = 0;
  let end = result.length;

  // Trim the delimiter from around the output string.
  while (result.charAt(start) === "\0") start++;
  if (start === end) return [];
  while (result.charAt(end - 1) === "\0") end--;

  return result.slice(start, end).split(/\0/g);
};

/**
 * Split the input string into an array of words, separating numbers.
 */
export const splitSeparateNumbers = (value: string): Array<string> => {
  const words = split(value);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const match = SPLIT_SEPARATE_NUMBER_RE.exec(word);
    if (match) {
      const offset = match.index + (match[1] ?? match[2]).length;
      words.splice(i, 1, word.slice(0, offset), word.slice(offset));
    }
  }

  return words;
};

/**
 * Convert a string to space separated lower case (`foo bar`).
 */
export const lowerCase = (input: string, options?: CaseOptions): string => {
  const [prefix, words, suffix] = splitPrefixSuffix(input, options);

  return (
    prefix +
    words.map(lowerFactory(options?.locale)).join(options?.delimiter ?? " ") +
    suffix
  );
};

/**
 * Convert a string to camel case (`fooBar`).
 */
export const camelCase = (input: string, options?: PascalCaseOptions): string => {
  const [prefix, words, suffix] = splitPrefixSuffix(input, options);

  const lower = lowerFactory(options?.locale);
  const upper = upperFactory(options?.locale);
  const transform = options?.mergeAmbiguousCharacters
    ? capitalCaseTransformFactory(lower, upper)
    : pascalCaseTransformFactory(lower, upper);

  return (
    prefix +
    words
      .map((word, index) => {
        if (index === 0) return lower(word);
        return transform(word, index);
      })
      .join(options?.delimiter ?? "") +
    suffix
  );
};

/**
 * Convert a string to pascal case (`FooBar`).
 */
export const pascalCase = (input: string, options?: PascalCaseOptions): string => {
  const [prefix, words, suffix] = splitPrefixSuffix(input, options);

  const lower = lowerFactory(options?.locale);
  const upper = upperFactory(options?.locale);
  const transform = options?.mergeAmbiguousCharacters
    ? capitalCaseTransformFactory(lower, upper)
    : pascalCaseTransformFactory(lower, upper);

  return prefix + words.map(transform).join(options?.delimiter ?? "") + suffix;
};

/**
 * Convert a string to pascal snake case (`Foo_Bar`).
 */
export const pascalSnakeCase = (input: string, options?: CaseOptions): string =>
  capitalCase(input, { delimiter: "_", ...options });

/**
 * Convert a string to capital case (`Foo Bar`).
 */
export const capitalCase = (input: string, options?: CaseOptions): string => {
  const [prefix, words, suffix] = splitPrefixSuffix(input, options);

  const lower = lowerFactory(options?.locale);
  const upper = upperFactory(options?.locale);

  return (
    prefix +
    words.map(capitalCaseTransformFactory(lower, upper)).join(options?.delimiter ?? " ") +
    suffix
  );
};

/**
 * Convert a string to constant case (`FOO_BAR`).
 */
export const constantCase = (input: string, options?: CaseOptions): string => {
  const [prefix, words, suffix] = splitPrefixSuffix(input, options);

  return (
    prefix +
    words.map(upperFactory(options?.locale)).join(options?.delimiter ?? "_") +
    suffix
  );
};

/**
 * Convert a string to dot case (`foo.bar`).
 */
export const dotCase = (input: string, options?: CaseOptions): string =>
  lowerCase(input, { delimiter: ".", ...options });

/**
 * Convert a string to kebab case (`foo-bar`).
 */
export const kebabCase = (input: string, options?: CaseOptions): string =>
  lowerCase(input, { delimiter: "-", ...options });

/**
 * Convert a string to path case (`foo/bar`).
 */
export const pathCase = (input: string, options?: CaseOptions): string =>
  lowerCase(input, { delimiter: "/", ...options });

/**
 * Convert a string to sentence case (`Foo bar`).
 */
export const sentenceCase = (input: string, options?: CaseOptions): string => {
  const [prefix, words, suffix] = splitPrefixSuffix(input, options);

  const lower = lowerFactory(options?.locale);
  const upper = upperFactory(options?.locale);
  const transform = capitalCaseTransformFactory(lower, upper);

  return (
    prefix +
    words
      .map((word, index) => {
        if (index === 0) return transform(word);
        return lower(word);
      })
      .join(options?.delimiter ?? " ") +
    suffix
  );
};

/**
 * Convert a string to snake case (`foo_bar`).
 */
export const snakeCase = (input: string, options?: CaseOptions): string =>
  lowerCase(input, { delimiter: "_", ...options });

/**
 * Convert a string to header case (`Foo-Bar`).
 */
export const headerCase = (input: string, options?: CaseOptions): string =>
  capitalCase(input, { delimiter: "-", ...options });

/**
 * Factories
 */
const lowerFactory = (locale: Locale): ((input: string) => string) =>
  locale === false
    ? (input: string): string => input.toLowerCase()
    : (input: string): string => input.toLocaleLowerCase(locale);

const upperFactory = (locale: Locale): ((input: string) => string) =>
  locale === false
    ? (input: string): string => input.toUpperCase()
    : (input: string): string => input.toLocaleUpperCase(locale);

const capitalCaseTransformFactory =
  (lower: (input: string) => string, upper: (input: string) => string) =>
  (word: string): string =>
    `${upper(word[0])}${lower(word.slice(1))}`;

const pascalCaseTransformFactory =
  (lower: (input: string) => string, upper: (input: string) => string) =>
  (word: string, index: number): string => {
    const char0 = word[0];
    const initial =
      index > 0 && char0 >= "0" && char0 <= "9" ? "_" + char0 : upper(char0);
    return initial + lower(word.slice(1));
  };

/**
 * String splitter
 */
const splitPrefixSuffix = (
  input: string,
  options: CaseOptions = {},
): [string, string[], string] => {
  const splitFn =
    options.split ?? (options.separateNumbers ? splitSeparateNumbers : split);
  const prefixCharacters = options.prefixCharacters ?? DEFAULT_PREFIX_SUFFIX_CHARACTERS;
  const suffixCharacters = options.suffixCharacters ?? DEFAULT_PREFIX_SUFFIX_CHARACTERS;
  let prefixIndex = 0;
  let suffixIndex = input.length;

  while (prefixIndex < input.length) {
    const char = input.charAt(prefixIndex);
    if (!prefixCharacters.includes(char)) break;
    prefixIndex++;
  }

  while (suffixIndex > prefixIndex) {
    const index = suffixIndex - 1;
    const char = input.charAt(index);
    if (!suffixCharacters.includes(char)) break;
    suffixIndex = index;
  }

  return [
    input.slice(0, prefixIndex),
    splitFn(input.slice(prefixIndex, suffixIndex)),
    input.slice(suffixIndex),
  ];
};
