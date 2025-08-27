import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";

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
  const server = new rpc.Server(rpcUrl);

  // You still need a valid on-ledger account to build a tx to simulate
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
    .setTimeout(30)
    .build();

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