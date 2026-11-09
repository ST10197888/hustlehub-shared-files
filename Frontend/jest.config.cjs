module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  setupFilesAfterEnv: ["<rootDir>/src/testSetup.js"],
  testMatch: ["<rootDir>/src/__tests__/**/*.test.jsx"]
};