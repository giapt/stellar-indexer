type MatchResult = {
  path: string;
  node: any;
};

/**
 * Recursively searches for all objects where:
 *  obj.vec is an array AND contains { symbol: "LockedToken" }.
 * Returns array of matches with JSON path and object.
 */
export function findVecWithSymbol(root: any, symbol = "LockedToken"): MatchResult[] {
  const results: MatchResult[] = [];

  function walk(node: any, path: string) {
    if (node && typeof node === "object") {
      // Check if this object has vec with our symbol
      if (
        "vec" in node &&
        Array.isArray(node.vec) &&
        node.vec.some((item: { symbol: string; }) => item && item.symbol === symbol)
      ) {
        results.push({ path, node });
      }

      if (Array.isArray(node)) {
        node.forEach((child, i) => walk(child, `${path}[${i}]`));
      } else {
        for (const [key, value] of Object.entries(node)) {
          walk(value, `${path}.${key}`);
        }
      }
    }
  }

  walk(root, "$");
  return results;
}

export function getLockedTokenFromJson(json: any, symbol = "LockedToken"): number[] {
  const matches = findVecWithSymbol(json, symbol);

  // Convert results to an array of objects (if you just want the nodes)
  const resultArray = matches.map((m) => m.node?.vec?.[1]?.u32);
  return resultArray;
}