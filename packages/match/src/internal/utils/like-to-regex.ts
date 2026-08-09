/**
 * SQL `LIKE` pattern → `RegExp`. `%` is any run, `_` is any single character;
 * everything else is escaped, and the pattern is anchored at both ends because
 * SQL `LIKE` matches the WHOLE value.
 */
export const likeToRegex = (pattern: string, caseInsensitive: boolean): RegExp => {
  let regexStr = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "%") regexStr += ".*";
    else if (char === "_") regexStr += ".";
    else if (/[\\^$.|?*+()[\]{}]/.test(char)) regexStr += `\\${char}`;
    else regexStr += char;
  }
  return new RegExp(`^${regexStr}$`, caseInsensitive ? "i" : "");
};
