const isNotExample = (file) => !/\/example\//.test(file);

export default {
  "*.{js,jsx,ts,tsx}": (files) => {
    const lintable = files.filter(isNotExample);
    const cmds = ["prettier --write " + files.join(" ")];
    if (lintable.length) cmds.unshift("eslint --fix " + lintable.join(" "));
    return cmds;
  },
  "*.{json,md}": ["prettier --write"],
  "{package.json,packages/*/package.json}": [
    "bash -c 'npx syncpack fix && npx syncpack fix'",
    "prettier --write",
  ],
};
