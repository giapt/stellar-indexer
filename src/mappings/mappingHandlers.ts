import {
  StellarHandlerKind, EventHandlerDef,
  eventMatchesHandler, DecodedEvent
} from '../handlers';
import { decodeEnvelopeForTx } from '../utils/tx-utils';
import { prisma } from '../prismaConfig'; // Ensure you have a Prisma client instance
import { fetchTokenMetadata } from '../utils/metadata';
import {
  Networks,
} from "@stellar/stellar-sdk";
const DEBUG = process.env.DEBUG === 'true';


// ==== Your handlers ====
export async function handleMintEvent(ev: DecodedEvent) {
  console.log('[Mint]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    const constructorArgs =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.create_contract_v2?.constructor_args;
    let name = 'Unknown';
    let symbol = 'Unknown';
    let decimals = 0; 
    let totalSupply = "0";
    let ipfs = '';
    if (constructorArgs?.[0]?.address) {
      name = constructorArgs[2]?.string || 'Unknown';
      symbol = constructorArgs[3]?.string || 'Unknown';
      decimals = constructorArgs[1]?.u32 || 0;
      totalSupply = constructorArgs[4]?.i128 || "0";
      ipfs = constructorArgs[5]?.string || '';
    }
    if (constructorArgs?.[4]?.address) {
      name = constructorArgs[0]?.string || 'Unknown';
      symbol = constructorArgs[1]?.string || 'Unknown';
      decimals = constructorArgs[2]?.u32 || 0;
      totalSupply = constructorArgs[3]?.i128 || "0";
      ipfs = constructorArgs[5]?.string || '';
    }
    if (DEBUG) {
      console.log('[Mint] constructor args:', constructorArgs);
      console.log('[Mint] decoded envelope', ev.contractId, constructorArgs[0]?.string);
    }

    await prisma.teamFinanceTokens.create({
      data: {
        txHash: ev.txHash,
        contractId: ev.contractId,
        address: ev.contractId,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        owner: ev.data,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        network: 'stellar-testnet', // Adjust as needed
        name,
        symbol,
        decimals,
        totalSupply,
        ipfs,
        envelopeXdr,
        id: `${ev.contractId}-stellar-testnet`,
      }
    });

  } catch (e) {
    console.error('[Mint] envelope decode failed', ev.txHash, e);
  }
}

export async function handleUpdateMetadataEvent(ev: DecodedEvent) {
  console.log('[UpdateMetadata]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
}

export async function handleDepositEvent(ev: DecodedEvent) {
  console.log('[Deposit]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[Deposit] decoded envelope XDR:', envelopeXdr);
    // console.log('[Deposit] decoded envelope', ev.contractId, data);
    const args =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.args;
    console.log('[Deposit] args:', args);
    const contractData = data.tx.tx.ext?.v1?.resources?.footprint?.read_write?.[4]?.contract_data?.key?.vec;
    const depositId = contractData?.[1]?.u32 || 0;
    console.log('[Deposit] depositId:', depositId);

    let name = 'Unknown';
    let symbol = 'Unknown';
    let decimals = 0;
    let totalSupply = "0";
    let ipfs = '';
    let owner = '';

    const tokenAddress = args?.[1]?.address || '';

    const teamFinanceToken = await prisma.teamFinanceTokens.findUnique({
      where: { id: `${tokenAddress}-stellar-testnet` },
    });
    const tokenDb = await prisma.token.findUnique({
      where: { id: `${tokenAddress}-stellar-testnet` },
    });
    if (!teamFinanceToken && !tokenDb) {
      console.log('[Deposit] No team finance token found for contract:', tokenAddress);
      const publicKey = "GBXY232X43NSRHK35R4IGV5CTG3EGI6YWZ2GUA3WGPVYN6TWTW5P55VG";
      const tokenMetadata = await fetchTokenMetadata(
        process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
        process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
        args?.[1]?.address,
        publicKey
      );
      name = tokenMetadata.name;
      symbol = tokenMetadata.symbol;
      decimals = tokenMetadata.decimals;
      totalSupply = tokenMetadata.totalSupply;
      ipfs = tokenMetadata.metadata || '';
      owner = tokenMetadata.owner || '';
      console.log('[Deposit] Fetched metadata:', {
        name, symbol, decimals, totalSupply, ipfs, owner
      });
      await prisma.token.create({
        data: {
          id: `${tokenAddress}-stellar-testnet`,
          address: tokenAddress,
          name,
          symbol,
          decimals,
          totalSupply,
          ipfs,
          owner,
          network: 'stellar-testnet', // Adjust as needed
        }
      });
    } else {
      if (teamFinanceToken) {
        name = teamFinanceToken.name;
        symbol = teamFinanceToken.symbol;
        decimals = teamFinanceToken.decimals;
        totalSupply = teamFinanceToken.totalSupply;
        ipfs = teamFinanceToken.ipfs || '';
        owner = teamFinanceToken.owner || '';
      }
      if (tokenDb) {
        name = tokenDb.name;
        symbol = tokenDb.symbol;
        decimals = tokenDb.decimals;
        totalSupply = tokenDb.totalSupply;
        ipfs = tokenDb.ipfs || '';
        owner = tokenDb.owner || '';
      }
    }

    await prisma.deposits.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: args?.[1]?.address || '',
        withdrawalAddress: args?.[2]?.address || '',
        amount: args?.[3]?.i128 || "0",
        unlockTime: BigInt(args?.[4]?.u64) || BigInt(0),
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        token_name: name,
        token_symbol: symbol,
        token_totalSupply: totalSupply,
        token_decimals: decimals,
        token_ipfs: ipfs,
        token_owner: owner,
        network: 'stellar-testnet', // Adjust as needed
        // update todo: call contract to getDepositDetails
        deposit_withdrawn: false,
        deposit_tokenId: BigInt(0),
        deposit_isNFT: false,
        deposit_migratedLockDepositId: BigInt(0),
        deposit_isNFTMinted: false,
      }
    });
  }
  catch (error) {
    console.error('[Deposit] Error handling deposit event:', error);
  }

}
