import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTRACT_ADDRESS, STUDIONET_CHAIN_ID_HEX } from "../config";
import { connectWallet, isStudioNetChainId, TruthBets } from "./contract";

afterEach(() => {
  if ("window" in globalThis) {
    delete (globalThis as any).window;
  }
});

describe("StudioNet wallet configuration", () => {
  it("uses the correct StudioNet chain id for add/switch requests", () => {
    expect(STUDIONET_CHAIN_ID_HEX).toBe("0xF22F");
    expect(isStudioNetChainId("0xF22F")).toBe(true);
    expect(isStudioNetChainId("0xF23F")).toBe(false);
  });

  it("fails closed if the wallet cannot be placed on StudioNet", async () => {
    const provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts") return ["0xabc"];
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_switchEthereumChain") {
          throw Object.assign(new Error("wallet rejected"), { code: 4001 });
        }
        throw new Error(`Unexpected method: ${method}`);
      }),
    };

    (globalThis as any).window = { ethereum: provider };

    await expect(connectWallet()).rejects.toThrow(
      "Could not place wallet on StudioNet",
    );
  });
});

describe("transaction finalization", () => {
  it("waits for FINALIZED before treating a write as successful", async () => {
    const client = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "FINALIZED" }),
    };

    const contract = new TruthBets(client, CONTRACT_ADDRESS);
    await expect(contract.waitForReceipt("0xabc")).resolves.toMatchObject({
      status: "FINALIZED",
    });

    expect(client.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FINALIZED" }),
    );
  });

  it("throws if the transaction is not finalized successfully", async () => {
    const client = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "REVERTED" }),
    };

    const contract = new TruthBets(client, CONTRACT_ADDRESS);
    await expect(contract.waitForReceipt("0xabc")).rejects.toThrow(
      "not finalized successfully",
    );
  });
});