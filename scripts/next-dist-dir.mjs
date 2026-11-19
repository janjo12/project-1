export function getNextDistDir(env = process.env) {
  return env.NEXT_DIST_DIR ?? (env.NODE_ENV === "development" ? ".next-dev" : ".next");
}
