import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["react-native", "react-native-web", "@expo/vector-icons"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native$": "react-native-web",
    };
    return config;
  },
};

export default nextConfig;