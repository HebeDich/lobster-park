import { writeAcceptanceLiveIndex } from './lib/openclaw-acceptance-live-index.mjs';

const file = writeAcceptanceLiveIndex();
console.log(`wrote ${file}`);
