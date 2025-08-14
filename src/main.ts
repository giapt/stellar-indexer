import { runIndexer } from './indexer';

runIndexer().catch(err => {
  console.error('Indexer failed:', err);
  process.exit(1);
});