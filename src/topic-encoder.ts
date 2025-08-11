import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';

// Turn "sym:transfer" or "addr:G..." or "u32:123" or "*" into what RPC expects
export function encodeTopicSegment(seg: string): string {
  if (seg === '*') return '*';

  const [kind, ...rest] = seg.split(':');
  const val = rest.join(':');

  switch (kind) {
    case 'sym': {
      // symbol -> ScVal symbol -> base64 XDR
      return nativeToScVal(val, { type: 'symbol' }).toXDR('base64');
    }
    case 'addr': {
      const addr = Address.fromString(val);
      return addr.toScVal().toXDR('base64');
    }
    case 'u32': {
      const sc = nativeToScVal(Number(val), { type: 'u32' });
      return sc.toXDR('base64');
    }
    case 'i128': {
      const sc = nativeToScVal(BigInt(val), { type: 'i128' });
      return sc.toXDR('base64');
    }
    case 'bytes': {
      // hex bytes -> ScVal bytes
      const bytes = Buffer.from(val.replace(/^0x/, ''), 'hex');
      return nativeToScVal(Uint8Array.from(bytes), { type: 'bytes' }).toXDR('base64');
    }
    default: {
      // default: treat as symbol for convenience
      return nativeToScVal(seg, { type: 'symbol' }).toXDR('base64');
    }
  }
}

export function encodeTopicFilterHuman(human: string[][]): string[][] {
  return human.map(arr => arr.map(encodeTopicSegment));
}
