import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Bundle ALL dependencies into a single self-contained file.
  // This allows Claude Desktop to run the MCP server without node_modules.
  noExternal: [/.*/],
});
