import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const appRoot = 'app';
const output = process.env.P15_ROUTE_OUTPUT ?? 'reviews/evidence/p15-baseline/route-inventory.json';

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function routeFromPage(path) {
  const directory = relative(appRoot, path.slice(0, -'page.tsx'.length));
  const route = `/${directory.split(sep).filter(Boolean).join('/')}`;
  return route === '/' ? route : route.replace(/\/$/, '');
}

function classify(route) {
  if (route === '/' || route === '/me' || route === '/artist' || route === '/score/[id]') return 'production';
  if (route === '/v1' || route === '/star') return 'compatibility';
  if (/^\/(test\d*|score-lab)(\/|$)/.test(route)) return 'sandbox';
  if (/^\/echo(\/|$)/.test(route)) return 'production-p14';
  return 'unclassified';
}

const allFiles = await walk(appRoot);
const pages = allFiles.filter((path) => path.endsWith(`${sep}page.tsx`) || path === join(appRoot, 'page.tsx'));
const inventory = pages.map((page) => {
  const route = routeFromPage(page);
  const directory = page.slice(0, -'page.tsx'.length);
  return {
    route,
    classification: classify(route),
    page: page.replaceAll(sep, '/'),
    hasLoading: allFiles.includes(join(directory, 'loading.tsx')),
  };
}).sort((left, right) => left.route.localeCompare(right.route));

await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), inventory }, null, 2));
console.log(`已写入 ${output}：${inventory.length} 条页面路由`);
