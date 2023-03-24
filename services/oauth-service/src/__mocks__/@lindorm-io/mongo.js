const { createMockMongoRepository } = require("@lindorm-io/mongo");
const mongo = jest.createMockFromModule("@lindorm-io/mongo");

module.exports = { ...mongo, createMockMongoRepository };
