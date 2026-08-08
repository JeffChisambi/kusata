import { Generator, getConfig } from '@tanstack/router-generator';
import path from 'node:path';
const root = process.cwd();
const config = getConfig({
  routesDirectory: path.join(root, 'src/routes'),
  generatedRouteTree: path.join(root, 'src/routeTree.gen.ts'),
  quoteStyle: 'single',
}, root);
const gen = new Generator({ config, root });
await gen.run();
console.log('ROUTE TREE GENERATED');
