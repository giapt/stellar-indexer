// src/prettyScVal.ts
import { xdr, scValToNative } from '@stellar/stellar-sdk';

function prettyBinary(u8: Uint8Array): string {
  if (!u8 || u8.length === 0) return '0x';
  return '0x' + Buffer.from(u8).toString('hex');
}

export function prettyScVal(val: xdr.ScVal): string {
  switch (val.switch()) {
    case xdr.ScValType.scvU32():
      return `${val.u32()}u32`;

    case xdr.ScValType.scvU64():
      // u64 is an XDR opaque integer; stringify via toString()
      return `${val.u64().toString()}u64`;

    case xdr.ScValType.scvI32():
      return `${val.i32()}i32`;

    case xdr.ScValType.scvI64():
      return `${val.i64().toString()}i64`;

    case xdr.ScValType.scvU128(): {
      const bi = scValToNative(val) as bigint; // safe: SDK returns bigint
      return `${bi.toString()}u128`;
    }

    case xdr.ScValType.scvI128(): {
      const bi = scValToNative(val) as bigint; // safe: SDK returns bigint
      return `${bi.toString()}i128`;
    }

    case xdr.ScValType.scvU256():
    case xdr.ScValType.scvI256(): {
      // Render bytes as 0x… (SDK exposes raw bytes for 256-bit types)
      // // @ts-expect-error: u256/i256 accessors differ across SDK versions; handle both
      const bytes: Uint8Array =
        (val as any).u256?.() ??
        (val as any).i256?.() ??
        new Uint8Array();
      return prettyBinary(bytes);
    }

    case xdr.ScValType.scvSymbol():
      return `"${val.sym().toString()}"sym`;

    case xdr.ScValType.scvString():
      return `"${val.str().toString()}"str`;

    case xdr.ScValType.scvBool():
      return val.b() ? 'true' : 'false';

    case xdr.ScValType.scvAddress(): {
      // Recent SDKs provide toString() → G... / C...
      const a = val.address();
      return a.toString();
    }

    case xdr.ScValType.scvBytes():
      return prettyBinary(val.bytes());

    case xdr.ScValType.scvVec(): {
      const v = val.vec();
      if (!v) return '[]';
      return `[${v.map(prettyScVal).join(', ')}]`;
    }

    case xdr.ScValType.scvMap(): {
      const m = val.map();
      if (!m) return '{}';
      const parts = m.map(entry => {
        const k = entry.key();
        const v = entry.val();
        if (k.switch() === xdr.ScValType.scvSymbol()) {
          return `"${k.sym().toString()}"sym: ${prettyScVal(v)}`;
        } else if (k.switch() === xdr.ScValType.scvString()) {
          return `"${k.str().toString()}"str: ${prettyScVal(v)}`;
        } else {
          return `${prettyScVal(k)}: ${prettyScVal(v)}`;
        }
      });
      return `{${parts.join(', ')}}`;
    }

    // case xdr.ScValType.scvNull():
    //   return 'null';

    case xdr.ScValType.scvVoid():
      return 'void';

    case xdr.ScValType.scvError():
      return `<Error:${JSON.stringify(val.error())}>`;

    default:
      return `<ScVal ${val.switch().name}>`;
  }
}
