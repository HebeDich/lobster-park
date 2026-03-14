import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { generate } from 'openapi-typescript-codegen';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');
const specPath = path.join(rootDir, 'docs', 'archive', 'product-history', 'LobsterPark_Docs_V1_4', 'LobsterPark_OpenAPI_V1_4.yaml');
const outputDir = path.resolve(import.meta.dirname, '..', 'src', 'api', 'generated');

mkdirSync(outputDir, { recursive: true });

await generate({
  input: specPath,
  output: outputDir,
  httpClient: 'fetch',
  useUnionTypes: true,
  exportCore: true,
  exportServices: true,
  exportModels: true,
  exportSchemas: false
});

console.log(`Generated API client into ${outputDir}`);
