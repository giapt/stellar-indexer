import { NETWORKS } from './config';
import { runIndexer } from './indexer';

async function main() {
  await Promise.all(
    NETWORKS.map(net => runIndexer(net))
  );
}

main();