import { startGraphQL } from './graphql';
import { runIndexer } from './indexer';

startGraphQL();
runIndexer().catch(err => {
  console.error('Indexer failed:', err);
  process.exit(1);
});