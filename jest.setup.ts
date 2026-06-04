import { expect } from "@jest/globals";
import * as matchers from "@testing-library/react-native/matchers";

expect.extend(matchers);

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = (props: Record<string, unknown>) =>
    React.createElement(Text, props);

  return {
    FontAwesome: Icon,
    Ionicons: Icon,
  };
});

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: {
    Medium: "medium",
  },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native-reanimated", () =>
  (() => {
    const { View } = require("react-native");
    const passthrough = (value: unknown) => value;

    return {
      __esModule: true,
      cancelAnimation: jest.fn(),
      default: {
        View,
      },
      useAnimatedStyle: (factory: () => unknown) => factory(),
      useSharedValue: (initialValue: unknown) => ({
        set(nextValue: unknown) {
          this.value = nextValue;
        },
        value: initialValue,
      }),
      withRepeat: passthrough,
      withSequence: (...values: unknown[]) => values[values.length - 1],
      withTiming: passthrough,
    };
  })(),
);

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
