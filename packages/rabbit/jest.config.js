const base = require("../../jest.config.unit.base");
const packageJson = require("./package");

module.exports = {
  ...base,
  displayName: packageJson.name,
};
