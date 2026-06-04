import { expect } from "@jest/globals";
import * as matchers from "@testing-library/react-native/matchers";

expect.extend(matchers);

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
