import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpack from "webpack";
import { getNextDistDir } from "./scripts/next-dist-dir.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  distDir: getNextDistDir(),
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
  webpack(config, { isServer }) {
    config.resolve.extensions = [
      ".web.tsx",
      ".web.ts",
      ".web.js",
      ...config.resolve.extensions,
    ];
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native$": "react-native-web",
    };
    config.module.rules.push({
      test: /\.ttf$/,
      type: "asset/resource",
      generator: { filename: "static/fonts/[name].[contenthash][ext]" },
    });
    if (!isServer) {
      // Expo Font's browser loader imports its server-only AsyncLocalStorage helper.
      // Browser code only uses the helper's window-safe branches, so replace Node's
      // builtin import with an inert shim in the client bundle.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^node:async_hooks$/,
        path.resolve(projectRoot, "src/utils/expo-font-async-hooks.web.ts"),
      ));
    }
    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
        // Reanimated's web bundle expects the Node-style `global`; browsers expose the same object as `globalThis`.
        ...(!isServer ? { global: "globalThis" } : {
          // Reanimated Worklets can schedule frames while Next evaluates the
          // client bundle for SSR. Animations have no visible effect on the
          // server, so keep those callbacks inert in server-rendered bundles.
          requestAnimationFrame: "((callback) => 0)",
          cancelAnimationFrame: "((handle) => undefined)",
        }),
      }),
    );
    return config;
  },
};

export default nextConfig;
