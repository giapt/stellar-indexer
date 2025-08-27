import {
  StellarHandlerKind, EventHandlerDef,
  eventMatchesHandler, DecodedEvent
} from '../handlers';
import { decodeEnvelopeForTx } from '../utils/tx-utils';
import { prisma } from '../prismaConfig'; // Ensure you have a Prisma client instance
import { getMetadata } from '../utils/metadata';
import {
  Networks,
} from "@stellar/stellar-sdk";
import { getDepositDetails } from '../utils/contract';

const DEBUG = process.env.DEBUG === 'true';
const PUBLIC_KEY = process.env.PUBLIC_KEY || "GBXY232X43NSRHK35R4IGV5CTG3EGI6YWZ2GUA3WGPVYN6TWTW5P55VG";


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

    const tokenMetadata = await getMetadata(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
      process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      args?.[1]?.address,
      PUBLIC_KEY
    );

    const depositDetail = await getDepositDetails({
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      contractId: ev.contractId,
      sourcePublicKey: PUBLIC_KEY,
      depositId: depositId,
    });
    console.log('[Deposit] depositDetail:', depositDetail);

    await prisma.deposits.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        senderAddress: args?.[1]?.address || '',
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: args?.[1]?.address || '',
        withdrawalAddress: args?.[2]?.address || '',
        amount: args?.[3]?.i128 || "0",
        unlockTime: BigInt(args?.[4]?.u64) || BigInt(0),
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        token_name: tokenMetadata.name,
        token_symbol: tokenMetadata.symbol,
        token_totalSupply: tokenMetadata.totalSupply,
        token_decimals: tokenMetadata.decimals,
        token_ipfs: tokenMetadata.metadata,
        token_owner: tokenMetadata.owner,
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

export async function handleStakingPoolCreatedEvent(ev: DecodedEvent) {
  console.log('[StakingPoolCreated]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[StakingPoolCreated] decoded envelope XDR:', envelopeXdr);
    const contractData = data.tx.tx.ext?.v1?.resources?.footprint?.read_write?.[0]?.contract_data?.key?.vec;
    // console.log('[StakingPoolCreated] contractData:', contractData);
    const poolId = contractData?.[1]?.u32 || 0;
    // console.log('[StakingPoolCreated] poolId:', poolId);

    const args =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.args;
    // console.log('[StakingPoolCreated] args:', args);
    const stakingTokenAddress = ev.data[0];
    const rewardTokenAddress = ev.data[1];
    const startTime = BigInt(ev.data[2] || 0);
    const endTime = BigInt(ev.data[3] || 0);
    const precision = BigInt(ev.data[4] || 0);
    const totalReward = BigInt(ev.data[5] || 0);
    const statkingTokenMetadata = await getMetadata(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
      process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      stakingTokenAddress,
      PUBLIC_KEY
    );
    const rewardTokenMetadata = await getMetadata(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
      process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      rewardTokenAddress,
      PUBLIC_KEY
    );
    await prisma.stakingPools.create({
      data: {
        id: `${poolId.toString()}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        stakingContract: ev.contractId,
        contractId: ev.contractId,
        poolIndex: poolId.toString(),
        stakingToken: stakingTokenAddress,
        rewardToken: rewardTokenAddress,
        startTime,
        endTime,
        precision,
        totalReward,
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        owner: args?.[0]?.address || '',
        stakingToken_name: statkingTokenMetadata.name,
        stakingToken_symbol: statkingTokenMetadata.symbol,
        stakingToken_totalSupply: statkingTokenMetadata.totalSupply,
        stakingToken_decimals: statkingTokenMetadata.decimals,
        stakingToken_ipfs: statkingTokenMetadata.metadata,
        stakingToken_owner: statkingTokenMetadata.owner,
        rewardToken_name: rewardTokenMetadata.name,
        rewardToken_symbol: rewardTokenMetadata.symbol,
        rewardToken_totalSupply: rewardTokenMetadata.totalSupply,
        rewardToken_decimals: rewardTokenMetadata.decimals,
        rewardToken_ipfs: rewardTokenMetadata.metadata,
        rewardToken_owner: rewardTokenMetadata.owner,
        network: 'stellar-testnet', // Adjust as needed
      }
    });

  } catch (error) {
    console.error('[StakingPoolCreated] Error handling staking pool created event:', error);
  }
}
