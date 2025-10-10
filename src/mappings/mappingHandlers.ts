import {
  DecodedEvent
} from '../handlers';
import { decodeEnvelopeForTx } from '../utils/tx-utils';
import { prisma } from '../prismaConfig'; // Ensure you have a Prisma client instance
import { getMetadata, getMetadataLpToken, getMetadataNft } from '../utils/metadata';
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

export async function handleLpDepositEvent(ev: DecodedEvent) {
  console.log('[LPDeposit]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[LPDeposit] decoded envelope XDR:', envelopeXdr);
    const args =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.args;
    console.log('[LPDeposit] args:', args);
    const contractData = data.tx.tx.ext?.v1?.resources?.footprint?.read_write?.[1]?.contract_data?.key?.vec;
    const depositId = contractData?.[1]?.u32 || 0;
    console.log('[LPDeposit] depositId:', depositId);

    const tokenMetadata = await getMetadataLpToken(
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
    console.log('[LPDeposit] depositDetail:', depositDetail);

    await prisma.lpDeposits.create({
      data: {
        id: `${depositId.toString()}-lp-deposit-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        senderAddress: args?.[0]?.address || '',
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
        token_totalSupply: "0",
        token_decimals: tokenMetadata.decimals,
        token_ipfs: "",
        token_owner: "",
        network: 'stellar-testnet', // Adjust as needed
        deposit_withdrawn: depositDetail[4],
        deposit_tokenId: depositDetail[5] || BigInt(0),
        deposit_isNFT: depositDetail[6],
        deposit_migratedLockDepositId: BigInt(0),
        deposit_isNFTMinted: false,
      }
    });
    await prisma.depositDetail.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: args?.[1]?.address || '',
        withdrawalAddress: depositDetail[1],
        tokenAmount: depositDetail[2].toString(),
        unlockTime: BigInt(depositDetail[3]),
        token_name: tokenMetadata.name,
        token_symbol: tokenMetadata.symbol,
        token_totalSupply: "0",
        token_decimals: tokenMetadata.decimals,
        token_ipfs: "",
        token_owner: "",
        network: 'stellar-testnet',
        withdrawn: depositDetail[4],
        tokenId: depositDetail[5] || BigInt(0),
        isNFT: depositDetail[6],
        migratedLockDepositId: BigInt(0),
        isNFTMinted: false,
      }
    });
  }
  catch (error) {
    console.error('[LPDeposit] Error handling lp deposit event:', error);
  }
}

export async function handleNftDepositEvent(ev: DecodedEvent) {
  console.log('[NFTDeposit]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[Deposit] decoded envelope XDR:', envelopeXdr);
    // console.log('[Deposit] decoded envelope', ev.contractId, data);
    const args =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.args;
    console.log('[Deposit] args:', args);
    const contractData = data.tx.tx.ext?.v1?.resources?.footprint?.read_write?.[1]?.contract_data?.key?.vec;
    const depositId = contractData?.[1]?.u32 || 0;
    console.log('[Deposit] depositId:', depositId);

    const nftMetadata = await getMetadataNft(
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
    // console.log('[NFTDeposit] depositDetail:', depositDetail);
    await prisma.nftDeposits.create({
      data: {
        id: `${depositId.toString()}-nft-deposit-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        senderAddress: args?.[0]?.address || '',
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: args?.[1]?.address || '',
        withdrawalAddress: args?.[2]?.address || '',
        amount: args?.[3]?.i128 || "0",
        unlockTime: BigInt(args?.[4]?.u64) || BigInt(0),
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        tokenId: BigInt(ev.data[1]),
        nft_name: nftMetadata.name,
        nft_symbol: nftMetadata.symbol,
        nft_ipfs: "",
        nft_owner: ev.data[2],
        network: 'stellar-testnet', // Adjust as needed
        deposit_withdrawn: depositDetail[4],
        deposit_tokenId: depositDetail[5] || BigInt(0),
        deposit_isNFT: depositDetail[6],
        deposit_migratedLockDepositId: BigInt(0),
        deposit_isNFTMinted: false,
      }
    });
    
    await prisma.depositDetail.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: args?.[1]?.address || '',
        withdrawalAddress: depositDetail[1],
        tokenAmount: depositDetail[2].toString(),
        unlockTime: BigInt(depositDetail[3]),
        token_name: nftMetadata.name,
        token_symbol: nftMetadata.symbol,
        token_totalSupply: "0",
        token_decimals: 0,
        token_ipfs: "",
        token_owner: "",
        network: 'stellar-testnet',
        withdrawn: depositDetail[4],
        tokenId: depositDetail[5] || BigInt(0),
        isNFT: depositDetail[6],
        migratedLockDepositId: BigInt(0),
        isNFTMinted: false,
      }
    });
  }
  catch (error) {
    console.error('[NFTDeposit] Error handling nft deposit event:', error);
  }
}

export async function handleDepositEvent(ev: DecodedEvent) {
  console.log('[Deposit]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[Deposit] decoded envelope XDR:', envelopeXdr);
    // console.log('[Deposit] decoded envelope', ev.contractId, data);
    const function_name = data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.function_name;
    // console.log('[Deposit] function_name:', function_name);
    const args =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.args;
    //to do fix check args in split and create new
    console.log('[Deposit] args:', args);

    let depositId = 0;
    if (function_name === 'lock_token') {
      const contractData = data.tx.tx.ext?.v1?.resources?.footprint?.read_write?.[1]?.contract_data?.key?.vec;
      depositId = contractData?.[1]?.u32 || 0;
    } else {
      const contractData = data.tx.tx.ext?.v1?.resources?.footprint?.read_write?.[2]?.contract_data?.key?.vec;
      depositId = contractData?.[1]?.u32 || 0;
    }
    console.log('[Deposit] depositId:', depositId);
    const tokenAddress= ev.data[0];
    const withdrawalAddress= ev.data[1];
    const amount= ev.data[2];
    const unlockTime= BigInt(ev.data[3] || 0);

    const tokenMetadata = await getMetadata(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
      process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      tokenAddress,
      PUBLIC_KEY
    );

    const depositDetail = await getDepositDetails({
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      contractId: ev.contractId,
      sourcePublicKey: PUBLIC_KEY,
      depositId: depositId,
    });
    // console.log('[Deposit] depositDetail:', depositDetail);
    const deposit = await prisma.deposits.findUnique({
      where: { id: `${depositId.toString()}-stellar-testnet` },
      // todo update when network changes
    });
    if (deposit) {
      await prisma.deposits.update({
        where: { id: `${depositId.toString()}-stellar-testnet` },
        data: {
          blockHeight: ev.ledger,
        sequence: ev.ledger,
        senderAddress: args?.[0]?.address || '',
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: tokenAddress || '',
        withdrawalAddress: withdrawalAddress || '',
        amount: amount || "0",
        unlockTime: unlockTime || BigInt(0),
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        token_name: tokenMetadata.name,
        token_symbol: tokenMetadata.symbol,
        token_totalSupply: tokenMetadata.totalSupply,
        token_decimals: tokenMetadata.decimals,
        token_ipfs: tokenMetadata.metadata,
        token_owner: tokenMetadata.owner,
        network: 'stellar-testnet', // Adjust as needed
        deposit_withdrawn: depositDetail[4],
        deposit_tokenId: depositDetail[5] || BigInt(0),
        deposit_isNFT: depositDetail[6],
        deposit_migratedLockDepositId: BigInt(0),
        deposit_isNFTMinted: false,
        }
    });
  }  else {

    await prisma.deposits.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        senderAddress: args?.[0]?.address || '',
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: tokenAddress || '',
        withdrawalAddress: withdrawalAddress || '',
        amount: amount || "0",
        unlockTime: unlockTime || BigInt(0),
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        token_name: tokenMetadata.name,
        token_symbol: tokenMetadata.symbol,
        token_totalSupply: tokenMetadata.totalSupply,
        token_decimals: tokenMetadata.decimals,
        token_ipfs: tokenMetadata.metadata,
        token_owner: tokenMetadata.owner,
        network: 'stellar-testnet', // Adjust as needed
        deposit_withdrawn: depositDetail[4],
        deposit_tokenId: depositDetail[5] || BigInt(0),
        deposit_isNFT: depositDetail[6],
        deposit_migratedLockDepositId: BigInt(0),
        deposit_isNFTMinted: false,
      }
    });
  }
    await prisma.depositDetail.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress: args?.[1]?.address || '',
        withdrawalAddress: depositDetail[1],
        tokenAmount: depositDetail[2].toString(),
        unlockTime: BigInt(depositDetail[3]),
        token_name: tokenMetadata.name,
        token_symbol: tokenMetadata.symbol,
        token_totalSupply: "0",
        token_decimals: tokenMetadata.decimals,
        token_ipfs: "",
        token_owner: "",
        network: 'stellar-testnet',
        withdrawn: depositDetail[4],
        tokenId: depositDetail[5] || BigInt(0),
        isNFT: depositDetail[6],
        migratedLockDepositId: BigInt(0),
        isNFTMinted: false,
      }
    });
  }
  catch (error) {
    console.error('[Deposit] Error handling deposit event:', error);
  }

}

export async function handleTransferLockEvent(ev: DecodedEvent) {
  console.log('[TransferLock]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[TransferLock] decoded envelope XDR:', envelopeXdr);
    const newOwner = ev.data[2];
    const depositId = ev.data[0];
    const depositDetail = await getDepositDetails({
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      contractId: ev.contractId,
      sourcePublicKey: PUBLIC_KEY,
      depositId: depositId,
    });
    const deposit = await prisma.depositDetail.findUnique({
      where: { id: `${depositId.toString()}-stellar-testnet` },
      // todo update when network changes
    });
    if (!deposit) {
      console.log(`[TransferLock] DepositDetail id ${depositId.toString()} not found, creating new record.`);
      // If deposit not found, create it first
      await createDepositDetail(depositId, ev.contractId);
    } else {
      await prisma.depositDetail.update({
        where: { id: `${depositId.toString()}-stellar-testnet` },
        data: {
          withdrawalAddress: newOwner,
        }
      });
    }
    await prisma.transferLocks.create({
      data: {
        id: `${ev.txHash}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        receiverAddress: newOwner,
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        network: 'stellar-testnet', // Adjust as needed
      }
    });
  } catch (error) {
    console.error('[TransferLock] Error handling transfer lock event:', error);
  }
}

export async function handleSplitLockEvent(ev: DecodedEvent) {
  console.log('[SplitLock]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
  try {
    console.log('Update deposit id:', ev.data[0]);
    const depositId = ev.data[0];
    const depositDetail = await getDepositDetails({
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      contractId: ev.contractId,
      sourcePublicKey: PUBLIC_KEY,
      depositId: depositId,
    });
    
    await prisma.lockSplits.create({
      data: {
        id: `${ev.txHash}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        remainingAmount: ev.data[1] || "0",
        splitLockId: BigInt(ev.data[2] || 0),
        newSplitLockAmount: ev.data[3] || "0",
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        network: 'stellar-testnet', // Adjust as needed
      }
    });

    const deposit = await prisma.depositDetail.findUnique({
      where: { id: `${depositId.toString()}-stellar-testnet` },
      // todo update when network changes
    });

    if (!deposit) {
      console.log(`[SplitLock] Deposit id ${depositId.toString()} not found, creating new record.`);
      // If deposit not found, create it first
      await createDepositDetail(depositId, ev.contractId);
    } else {
      await prisma.depositDetail.update({
        where: { id: `${depositId.toString()}-stellar-testnet` },
        data: {
          withdrawn: depositDetail[4],
          tokenId: depositDetail[5] || BigInt(0),
          isNFT: depositDetail[6],
          migratedLockDepositId: BigInt(0),
          isNFTMinted: false,
          tokenAmount: depositDetail[2].toString(),
          unlockTime: BigInt(depositDetail[3] || 0),
        }
      });
    }
  } catch (error) {
    console.error('[SplitLock] Error handling split lock event:', error);
  }
}

export async function handleNftWithdrawEvent(ev: DecodedEvent) {
  console.log('[NftWithdraw]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
    const networkTag = passphrase === Networks.PUBLIC ? 'stellar-mainnet' : 'stellar-testnet';
    const depositId = ev.data[0];
    const depositDetail = await getDepositDetails({
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      contractId: ev.contractId,
      sourcePublicKey: PUBLIC_KEY,
      depositId: depositId,
    });
    const tokenAddress= ev.data[1];
    const tokenId = BigInt(ev.data[2] || 0);
    const nftMetadata = await getMetadataNft(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
      process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      tokenAddress,
      PUBLIC_KEY
    );
    await prisma.logNftWithdrawals.create({
      data: {
        id: `${ev.txHash}-${networkTag}`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        network: networkTag, // Adjust as needed
        deposit_withdrawn: depositDetail[4],
        deposit_tokenId: depositDetail[5] || BigInt(0),
        deposit_isNFT: depositDetail[6],
        deposit_migratedLockDepositId: BigInt(0),
        deposit_isNFTMinted: false,
        tokenAddress: depositDetail[0],
        withdrawalAddress: depositDetail[1],
        amount: depositDetail[2].toString(),
        tokenId: tokenId,
      }
    });
    const deposit = await prisma.depositDetail.findUnique({
      where: { id: `${depositId.toString()}-${networkTag}` },
    });
    if (!deposit) {
      console.log(`[NftWithdraw] Deposit id ${depositId.toString()} not found, creating new record.`);
      // If deposit not found, create it first
      await prisma.depositDetail.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress,
        withdrawalAddress: depositDetail[1],
        tokenAmount: depositDetail[2].toString(),
        unlockTime: BigInt(depositDetail[3]),
        token_name: nftMetadata.name,
        token_symbol: nftMetadata.symbol,
        token_totalSupply: "0",
        token_decimals: 0,
        token_ipfs: "",
        token_owner: "",
        network: 'stellar-testnet',
        withdrawn: depositDetail[4],
        tokenId: tokenId,
        isNFT: depositDetail[6],
        migratedLockDepositId: BigInt(0),
        isNFTMinted: false,
      }
    });
    } else {

      await prisma.depositDetail.update({
        where: { id: `${depositId.toString()}-${networkTag}` },
        data: {
          withdrawn: depositDetail[4],
          tokenId: tokenId,
          isNFT: depositDetail[6],
          migratedLockDepositId: BigInt(0),
          isNFTMinted: false,
          tokenAmount: depositDetail[2].toString(),
          unlockTime: BigInt(depositDetail[3] || 0),
        }
      });
    }
  } catch (error) {
    console.error('[NftWithdraw] Error handling nft withdraw event:', error);
  }
}

export async function handleTokenWithdrawEvent(ev: DecodedEvent) {
  console.log('[TokenWithdraw]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    const passphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
    const networkTag = passphrase === Networks.PUBLIC ? 'stellar-mainnet' : 'stellar-testnet';
    const depositId = ev.data[0];
    const depositDetail = await getDepositDetails({
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      contractId: ev.contractId,
      sourcePublicKey: PUBLIC_KEY,
      depositId: depositId,
    });
    const tokenAddress= ev.data[1];
    // const tokenMetadata = await getMetadataLpToken(
    //   process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    //   process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
    //   tokenAddress,
    //   PUBLIC_KEY
    // );
    // todo fix call token metadata here

    await prisma.logTokenWithdrawals.create({
      data: {
        id: `${ev.txHash}-${networkTag}`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        network: networkTag, // Adjust as needed
        deposit_withdrawn: depositDetail[4],
        deposit_tokenId: depositDetail[5] || BigInt(0),
        deposit_isNFT: depositDetail[6],
        deposit_migratedLockDepositId: BigInt(0),
        deposit_isNFTMinted: false,
        tokenAddress: depositDetail[0],
        withdrawalAddress: depositDetail[1],
        amount: depositDetail[2].toString(),
      }
    });
    const deposit = await prisma.depositDetail.findUnique({
      where: { id: `${depositId.toString()}-${networkTag}` },
    });
    if (!deposit) {
      console.log(`[TokenWithdraw] Deposit id ${depositId.toString()} not found, creating new record.`);
      // If deposit not found, create it first
      await prisma.depositDetail.create({
      data: {
        id: `${depositId.toString()}-stellar-testnet`,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        tokenAddress,
        withdrawalAddress: depositDetail[1],
        tokenAmount: depositDetail[2].toString(),
        unlockTime: BigInt(depositDetail[3]),
        // token_name: tokenMetadata.name,
        // token_symbol: tokenMetadata.symbol,
        // token_totalSupply: "0",
        // token_decimals: tokenMetadata.decimals,
        token_name: "",
        token_symbol: "",
        token_totalSupply: "0",
        token_decimals: 0,
        token_ipfs: "",
        token_owner: "",
        network: 'stellar-testnet',
        withdrawn: depositDetail[4],
        tokenId: depositDetail[5] || BigInt(0),
        isNFT: depositDetail[6],
        migratedLockDepositId: BigInt(0),
        isNFTMinted: false,
      }
    });
    } else {

      await prisma.depositDetail.update({
        where: { id: `${depositId.toString()}-${networkTag}` },
        data: {
          withdrawn: depositDetail[4],
          tokenId: depositDetail[5] || BigInt(0),
          isNFT: depositDetail[6],
          migratedLockDepositId: BigInt(0),
          isNFTMinted: false,
          tokenAmount: depositDetail[2].toString(),
          unlockTime: BigInt(depositDetail[3] || 0),
        }
      });
    }
  } catch (error) {
    console.error('[TokenWithdraw] Error handling token withdraw event:', error);
  }
}

export async function handleExtendLockDurationEvent(ev: DecodedEvent) {
  console.log('[ExtendLockDuration]', ev.ledger, ev.contractId, ev.topicSignature, ev.data, ev.txHash);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    const depositId = ev.data[0];
    const newUnlockTime = BigInt(ev.data[1] || 0);
    const depositDetail = await getDepositDetails({
      rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      contractId: ev.contractId,
      sourcePublicKey: PUBLIC_KEY,
      depositId: depositId,
    });
    const deposit = await prisma.depositDetail.findUnique({
      where: { id: `${depositId.toString()}-stellar-testnet` },
      // todo update when network changes
    });
    if (!deposit) {
      console.log(`[ExtendLockDuration] Deposit id ${depositId.toString()} not found, creating new record.`);
      // If deposit not found, create it first
      await createDepositDetail(depositId, ev.contractId);
    }
    await prisma.depositDetail.update({
      where: { id: `${depositId.toString()}-stellar-testnet` },
      data: {
        withdrawn: depositDetail[4],
        tokenId: depositDetail[5] || BigInt(0),
        isNFT: depositDetail[6],
        migratedLockDepositId: BigInt(0),
        isNFTMinted: false,
        tokenAmount: depositDetail[2].toString(),
        unlockTime: newUnlockTime,
      }
    });
    
    await prisma.lockDurationExtendeds.create({
      data: {
        id: `${ev.txHash}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        lockContractAddress: ev.contractId,
        depositId: depositId.toString(),
        unlockTime: newUnlockTime,
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        network: 'stellar-testnet', // Adjust as needed
      }
    });
  }
  catch (error) {
    console.error('[ExtendLockDuration] Error handling extend lock duration event:', error);
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
    const precision = ev.data[4] || "0";
    const totalReward = ev.data[5] || "0";
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

export async function handleMultisendTokenEvent(ev: DecodedEvent) {
  console.log('[MultisendToken]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[MultisendToken] decoded envelope XDR:', envelopeXdr);
    const args =
    data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.args;
    // console.log('[MultisendToken] args:', args[2], args[3]);
    const tokenAddress = ev.data;
    // const totalAmount = BigInt(args?.[2]?.i128 || 0);
    const recipientsRaw = args?.[2]?.vec?.map((r: any) => r.address) || [];
    const amountsRaw = args?.[3]?.vec?.map((a: any) => a.i128 ?? "") || [];
    const recipients = recipientsRaw.toString()
    const amounts = amountsRaw.toString()
    // console.log('[MultisendToken] recipients:', recipients);
    // console.log('[MultisendToken] amounts:', amounts);
    const tokenMetadata = await getMetadata(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
      process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      tokenAddress,
      PUBLIC_KEY
    );
    await prisma.multisendTokens.create({
      data: {
        id: `${ev.txHash}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        contractAddress: ev.contractId,
        from: args?.[0]?.address || '',
        tokenAddress,
        recipients,
        amounts,
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        token_name: tokenMetadata.name,
        token_symbol: tokenMetadata.symbol,
        token_totalSupply: tokenMetadata.totalSupply,
        token_decimals: tokenMetadata.decimals,
        token_ipfs: tokenMetadata.metadata,
        token_owner: tokenMetadata.owner,
        network: 'stellar-testnet', // Adjust as needed
      }
    });

  } catch (error) {
    console.error('[MultisendToken] Error handling multisend token event:', error);
  }
}

export async function handleVestingCreatedEvent(ev: DecodedEvent) {
  console.log('[VestingCreated]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
  try {
    const { data, timestamp, envelopeXdr } = await decodeEnvelopeForTx(ev.txHash);
    // console.log('[VestingCreated] decoded envelope XDR:', envelopeXdr);
    // const args =
    // data.tx.tx.operations?.[0]?.body?.invoke_host_function?.host_function?.invoke_contract?.args;
    // // console.log('[VestingCreated] args:', args);
    // const contractData = data.tx.tx.ext?.v1?.resources?.footprint?.read_write?.[0]?.contract_data?.key?.vec;
    // const vestingId = contractData?.[1]?.u32 || 0;
    // console.log('[VestingCreated] vestingId:', vestingId);

    const tokenMetadata = await getMetadata(
      process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
      process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      ev.data[2],
      PUBLIC_KEY
    );

    await prisma.vestings.create({
      data: {
        id: `${ev.data[1].toString()}-stellar-testnet`,
        blockHeight: ev.ledger,
        sequence: ev.ledger,
        factoryContractAddress: ev.contractId,
        creator: ev.data[0] || '',
        tokenAddress: ev.data[2] || '',
        vestingAddress: ev.data[1] || '',
        merkleRoot: ev.data[3],
        tokenTotal: ev.data[4],
        fee: ev.data[5],
        claimed: "0",
        vesting_list_hash: ev.data[6] || '',
        txHash: ev.txHash,
        timestamp: BigInt(timestamp), // Convert to BigInt if needed
        token_name: tokenMetadata.name,
        token_symbol: tokenMetadata.symbol,
        token_totalSupply: tokenMetadata.totalSupply,
        token_decimals: tokenMetadata.decimals,
        token_ipfs: tokenMetadata.metadata,
        token_owner: tokenMetadata.owner,
        network: 'stellar-testnet', // Adjust as needed
      }
    });

  } catch (error) {
    console.error('[VestingCreated] Error handling vesting created event:', error);
  }
}

export async function handleVestingClaimedEvent(ev: DecodedEvent) {
  console.log('[VestingClaimed]', ev.ledger, ev.contractId, ev.topicSignature, ev.data);
  try {
    const vestingAddress = ev.data[0];
  } catch (error) {
    console.error('[VestingClaimed] Error handling vesting claimed event:', error);
  }
}

async function createDepositDetail(depositId: number, contractId: string) {
  // Check if deposit already exists
  console.log(`Creating deposit detail for id ${depositId} and contract ${contractId}`);
  const existing = await prisma.depositDetail.findUnique({
    where: { id: `${depositId.toString()}-stellar-testnet` },
  });
  if (existing) {
    console.log(`Deposit with id ${depositId} already exists.`);
    return;
  }
  const depositDetail = await getDepositDetails({
    rpcUrl: process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
    contractId: contractId,
    sourcePublicKey: PUBLIC_KEY,
    depositId: depositId,
  });
  if (!depositDetail) {
    console.log(`Deposit details for id ${depositId} not found.`);
    return;
  }
  const tokenAddress = depositDetail[0];
  const tokenMetadata = await getMetadata(
    process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
    tokenAddress,
    PUBLIC_KEY
  );
  // Create new deposit
  await prisma.depositDetail.create({
    data: {
      id: `${depositId.toString()}-stellar-testnet`,
      lockContractAddress: contractId,
      depositId: depositId.toString(),
      tokenAddress: tokenAddress || '',
      withdrawalAddress: depositDetail[1],
      tokenAmount: depositDetail[2].toString(),
      unlockTime: BigInt(depositDetail[3]),
      token_name: tokenMetadata.name,
      token_symbol: tokenMetadata.symbol,
      token_totalSupply: tokenMetadata.totalSupply,
      token_decimals: tokenMetadata.decimals,
      token_ipfs: tokenMetadata.metadata,
      token_owner: tokenMetadata.owner,
      network: 'stellar-testnet',
      withdrawn: depositDetail[4],
      tokenId: depositDetail[5] || BigInt(0),
      isNFT: depositDetail[6],
      migratedLockDepositId: BigInt(0),
      isNFTMinted: false,
    }
  });
}