module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/game/(.*)$": "<rootDir>/src/game/$1",
    "^@/multiplayer/(.*)$": "<rootDir>/src/multiplayer/$1",
  },
  roots: ["<rootDir>/__tests__"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/*.[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/example/"],
  watchman: false,
};
