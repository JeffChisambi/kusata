import { Generator, getConfig } from '@tanstack/router-generator';
import path from 'node:path';
const root = process.cwd();
const config = getConfig({
  routesDirectory: path.join(root, 'src/routes'),
  generatedRouteTree: path.join(root, 'src/routeTree.gen.ts'),
  quoteStyle: 'single',
}, root);
await new Generator({ config, root }).run();
console.log('ROUTE TREE GENERATED');
