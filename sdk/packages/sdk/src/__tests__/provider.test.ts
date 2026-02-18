import { describe, it, expect } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { ViemAdapter } from "../adapters/viem";

// Foundry default test private key (Anvil account #0)
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("ViemAdapter", () => {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  it("should construct with wallet and public client", () => {
    const adapter = new ViemAdapter(walletClient, publicClient);
    expect(adapter).toBeDefined();
    expect(adapter.isReadOnly).toBe(false);
  });

  it("should create a read-only adapter", () => {
    const adapter = ViemAdapter.readOnly(publicClient);
    expect(adapter).toBeDefined();
    expect(adapter.isReadOnly).toBe(true);
  });

  it("should return the connected address", async () => {
    const adapter = new ViemAdapter(walletClient, publicClient);
    const address = await adapter.getAddress();
    expect(address.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase());
  });

  it("should throw on getAddress in read-only mode", async () => {
    const adapter = ViemAdapter.readOnly(publicClient);
    await expect(adapter.getAddress()).rejects.toThrow("No account available");
  });

  it("should throw on writeContract in read-only mode", async () => {
    const adapter = ViemAdapter.readOnly(publicClient);
    await expect(
      adapter.writeContract({
        address: "0x0000000000000000000000000000000000000000",
        abi: [],
        functionName: "test",
      })
    ).rejects.toThrow("read-only");
  });

  it("should implement AegisProvider interface", () => {
    const adapter = new ViemAdapter(walletClient, publicClient);
    // Verify all required methods exist
    expect(typeof adapter.readContract).toBe("function");
    expect(typeof adapter.writeContract).toBe("function");
    expect(typeof adapter.waitForTransaction).toBe("function");
    expect(typeof adapter.watchContractEvent).toBe("function");
    expect(typeof adapter.getAddress).toBe("function");
    expect(typeof adapter.getChainId).toBe("function");
    expect(typeof adapter.isReadOnly).toBe("boolean");
  });
});
