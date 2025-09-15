import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  scValToNative,
} from "@stellar/stellar-sdk";
import { prisma } from '../prismaConfig'; // Ensure you have a Prisma client instance

type ViewResult = {
  symbol: string;
  name: string;
  totalSupply: string; // stringified BigInt/number
  decimals: number;
  owner: string;
  metadata: string; // metadata may be null if not set
};

type LPTokenViewResult = {
  symbol: string;
  name: string;
  decimals: number;
};

type NftViewResult = {
  symbol: string;
  name: string;
};

export async function getMetadataNft(
  rpcUrl: string,
  networkPassphrase: string,
  contractId: string,
  sourcePublicKey: string
): Promise<NftViewResult> {
  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(contractId);

  // helper to build & simulate a single-op view call
  const simulateView = async (fn: string, ...args: any[]) => {
    // for simulation you still need any valid account as source
    const account = await server.getAccount(sourcePublicKey);

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(contract.call(fn, ...args))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if ("error" in sim) {
      throw new Error(
        `Simulation error in ${fn}: ${JSON.stringify(sim.error)}`
      );
    }
    const retval = sim.result?.retval;
    if (!retval) throw new Error(`No retval from ${fn}`);
    return scValToNative(retval);
  };

  // run the four view calls in parallel (each is a single-op tx)
  const [symbol, name] = await Promise.all([
    simulateView("symbol"),
    simulateView("name"),
  ]);

  return { symbol, name };
}

export async function getMetadataLpToken(
  rpcUrl: string,
  networkPassphrase: string,
  contractId: string,
  sourcePublicKey: string
): Promise<LPTokenViewResult> {
  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(contractId);

  // helper to build & simulate a single-op view call
  const simulateView = async (fn: string, ...args: any[]) => {
    // for simulation you still need any valid account as source
    const account = await server.getAccount(sourcePublicKey);

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(contract.call(fn, ...args))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if ("error" in sim) {
      throw new Error(
        `Simulation error in ${fn}: ${JSON.stringify(sim.error)}`
      );
    }
    const retval = sim.result?.retval;
    if (!retval) throw new Error(`No retval from ${fn}`);
    return scValToNative(retval);
  };

  // run the four view calls in parallel (each is a single-op tx)
  const [symbol, name, decimals] = await Promise.all([
    simulateView("symbol"),
    simulateView("name"),
    simulateView("decimals")
  ]);

  return { symbol, name, decimals };
}

export async function getMetadata(
  rpcUrl: string,
  networkPassphrase: string,
  contractId: string,
  sourcePublicKey: string
): Promise<ViewResult> {
  const teamFinanceToken = await prisma.teamFinanceTokens.findUnique({
    where: { id: `${contractId}-stellar-testnet` },
    // todo update when network changes
  });
  if (teamFinanceToken) {
    return {
      symbol: teamFinanceToken.symbol,
      name: teamFinanceToken.name,
      totalSupply: teamFinanceToken.totalSupply,
      decimals: teamFinanceToken.decimals,
      owner: teamFinanceToken.owner,
      metadata: teamFinanceToken.ipfs || '',
    };
  }
  const tokenDb = await prisma.token.findUnique({
    where: { id: `${contractId}-stellar-testnet` },
    // todo update when network changes
  });
  if (tokenDb) {
    return {
      symbol: tokenDb.symbol,
      name: tokenDb.name,
      totalSupply: tokenDb.totalSupply,
      decimals: tokenDb.decimals,
      owner: tokenDb.owner,
      metadata: tokenDb.ipfs || '',
    };
  }
  const data = await fetchTokenMetadata(
    rpcUrl,
    networkPassphrase,
    contractId,
    sourcePublicKey
  );
  await prisma.token.create({
    data: {
      id: `${contractId}-stellar-testnet`,
      address: contractId,
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
      totalSupply: data.totalSupply,
      ipfs: data.metadata,
      owner: data.owner,
      network: 'stellar-testnet', // Adjust as needed
    }
  });
  return data;
}

export async function fetchTokenMetadata(
  rpcUrl: string,
  networkPassphrase: string,
  contractId: string,
  sourcePublicKey: string
): Promise<ViewResult> {
  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(contractId);

  // helper to build & simulate a single-op view call
  const simulateView = async (fn: string, ...args: any[]) => {
    // for simulation you still need any valid account as source
    const account = await server.getAccount(sourcePublicKey);

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(contract.call(fn, ...args))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if ("error" in sim) {
      throw new Error(
        `Simulation error in ${fn}: ${JSON.stringify(sim.error)}`
      );
    }
    const retval = sim.result?.retval;
    if (!retval) throw new Error(`No retval from ${fn}`);
    return scValToNative(retval);
  };

  // run the four view calls in parallel (each is a single-op tx)
  const [symbol, name, totalSupplyRaw, decimals] = await Promise.all([
    simulateView("symbol"),
    simulateView("name"),
    simulateView("total_supply"),
    simulateView("decimals")
  ]);

  let owner = '';
  try {
    owner = await simulateView("get_owner");
  } catch (error) {
    console.warn('get_owner view call failed:', error);
  }
  let metadata = '';
  try {
    metadata = await simulateView("metadata");
  } catch (error) {
    console.warn('metadata view call failed:', error);
  }

  // totalSupply may come back as BigInt; normalize to string for safety
  const totalSupply =
    typeof totalSupplyRaw === "bigint"
      ? totalSupplyRaw.toString()
      : String(totalSupplyRaw);

  return { symbol, name, totalSupply, decimals, owner, metadata };
}