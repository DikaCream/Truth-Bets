import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTruthBetsClient } from "../lib/client";
import { TruthBets } from "../lib/contract";
import { useWallet } from "../hooks/useWallet";

interface TruthBetsContextValue {
  wallet: ReturnType<typeof useWallet>;
  contract: TruthBets;
}

const TruthBetsContext = createContext<TruthBetsContextValue | null>(null);

export function TruthBetsProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const contract = useMemo(() => {
    const client = createTruthBetsClient(wallet.address);
    return new TruthBets(client);
  }, [wallet.address]);

  return (
    <TruthBetsContext.Provider value={{ wallet, contract }}>
      {children}
    </TruthBetsContext.Provider>
  );
}

export function useTruthBets(): TruthBetsContextValue {
  const ctx = useContext(TruthBetsContext);
  if (!ctx) {
    throw new Error("useTruthBets must be used within a TruthBetsProvider");
  }
  return ctx;
}
