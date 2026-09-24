import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import webpack from "webpack";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    "react-native",
    "react-native-web",
    "@expo/vector-icons",
    "expo",
    "expo-haptics",
    "expo-image",
    "expo-modules-core",
  ],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native$": "react-native-web",
    };
    config.module.rules.push({
      test: /\.ttf$/,
      type: "asset/resource",
      generator: { filename: "static/fonts/[name].[contenthash][ext]" },
    });
    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
      }),
    );
    return config;
  },
};

export default nextConfig;
