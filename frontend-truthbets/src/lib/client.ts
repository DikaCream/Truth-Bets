/**
 * Backwards-compatible barrel: the wallet/network implementation lives in
 * `contract.ts`; production code keeps importing from `lib/client`.
 */
export {
  createTruthBetsClient,
  getProvider,
  hasEthereumProvider,
  requestAccounts,
  getAccounts,
  getBalance,
  getChainId,
  onAccountsChanged,
  onChainChanged,
  isStudioNetChainId,
  ensureNetwork,
  connectWallet,
  formatAddress,
  parseGen,
  formatGen,
  TruthBets,
} from "./contract";
