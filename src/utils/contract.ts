import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";

// Cache rpc.Server instances per URL
const serverCache = new Map<string, rpc.Server>();
function getServer(rpcUrl: string): rpc.Server {
  if (!serverCache.has(rpcUrl)) serverCache.set(rpcUrl, new rpc.Server(rpcUrl));
  return serverCache.get(rpcUrl)!;
}

export async function getDepositDetails({
  rpcUrl,
  networkPassphrase,
  contractId,
  sourcePublicKey, // any funded account's public key
  depositId,  // deposit ID as BigInt
}: {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  sourcePublicKey: string;
  depositId: number
}) {
  const server = getServer(rpcUrl);
  const account = await server.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  // Build a single-operation transaction (Soroban requires one invoke per tx)
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "get_deposit_details",
        nativeToScVal(depositId, { type: "u32" }) // <-- ID = 1 as u32
      )
    )
    .setTimeout(300)
    .build();
  
  const xdr = tx.toXDR();

  // Simulate (read-only; nothing is submitted)
  const sim = await server.simulateTransaction(tx);
  if ("error" in sim) {
    throw new Error(`Simulation error: ${JSON.stringify(sim.error)}`);
  }

  const retval = sim.result?.retval;
  if (!retval) {
    throw new Error("No return value from simulation");
  }

  // Convert SCVal → native JS
  const result = scValToNative(retval);
  return result;
}