import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/escrow.ts",
    "src/dispute.ts",
    "src/treasury.ts",
    "src/factory.ts",
    "src/utils.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["viem", "ethers"],
});
