type Match = { path: string; param: string };

export const findAllMatches = (input: string): Array<Match> => {
  const regex = new RegExp(/(:[a-zA-Z0-9]+)|({[a-zA-Z0-9]+})/g);
  const matches: Array<Match> = [];

  let match: RegExpExecArray | null = null;
  let timeout = 100;

  do {
    match = regex.exec(input);
    timeout -= 1;

    if (!match) continue;

    if (match[1]) {
      matches.push({ path: match[1], param: match[1].replace(":", "") });
    }

    if (match[2]) {
      matches.push({ path: match[2], param: match[2].replace("{", "").replace("}", "") });
    }
  } while (match && timeout > 0);

  return matches;
};
