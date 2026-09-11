import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../public/mcns-data.js');

async function queryNeuprint(cypher) {
  const response = await fetch('https://neuprint.janelia.org/api/custom/custom', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({cypher, dataset: 'male-cns:v1.0'})
  });
  if (!response.ok) throw new Error(`NeuPrint HTTP ${response.status}`);
  return response.json();
}

function groupFor(row) {
  const haystack = `${row[1] || ''} ${row[2] || ''} ${row[3] || ''}`.toLowerCase();
  if (/visual|optic|lamina|medulla|lobula|eye|v2ln/.test(haystack)) return 0;
  if (/memory|mushroom|kenyon|learning|mbon|dan/.test(haystack)) return 1;
  if (/\bcx\b|central complex/.test(haystack)) return 2;
  if (/olfactory|alpn|alln|gng|lln/.test(haystack)) return 3;
  if (/motor|descending|muscle|mechanosensory|gustatory|\bmn\w*|\bdn\w*/.test(haystack)) return 4;
  return 2;
}

function parseSwc(text, maxSegments = 850) {
  const points = new Map();
  const segments = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line[0] === '#') continue;
    const p = line.trim().split(/\s+/);
    if (p.length < 7) continue;
    const id = Number(p[0]), x = Number(p[2]), y = Number(p[3]), z = Number(p[4]), parent = Number(p[6]);
    const point = [x, y, z];
    if (parent > 0 && points.has(parent)) {
      const a = points.get(parent);
      segments.push([a[0], a[1], a[2], x, y, z]);
    }
    points.set(id, point);
  }
  const step = Math.max(1, Math.ceil(segments.length / maxSegments));
  return segments.filter((_, i) => i % step === 0).map(s => s.map(v => Math.round(v * 10) / 10));
}

const edgeResult = await queryNeuprint(`MATCH (a:Neuron)-[e:ConnectsTo]->(b:Neuron)
WHERE a.CentralBrain = true OR a.GNG = true
RETURN a.bodyId AS source, b.bodyId AS target, e.weight AS weight
ORDER BY e.weight DESC LIMIT 420`);
const classQueries = [
  `MATCH (n:Neuron) WHERE n.class = 'visual' RETURN n.bodyId AS id ORDER BY n.post DESC LIMIT 3`,
  `MATCH (n:Neuron) WHERE n.class IN ['Kenyon_Cell','MBON'] RETURN n.bodyId AS id ORDER BY n.post DESC LIMIT 3`,
  `MATCH (n:Neuron) WHERE n.class = 'CX' RETURN n.bodyId AS id ORDER BY n.post DESC LIMIT 3`,
  `MATCH (n:Neuron) WHERE n.class IN ['olfactory','ALPN','ALLN'] RETURN n.bodyId AS id ORDER BY n.post DESC LIMIT 3`,
  `MATCH (n:Neuron) WHERE n.type STARTS WITH 'MN' OR n.type STARTS WITH 'DN' RETURN n.bodyId AS id ORDER BY n.post DESC LIMIT 3`
];
const selectedIds = (await Promise.all(classQueries.map(queryNeuprint))).flatMap(result => (result.data || []).map(row => row[0])).filter(Number.isFinite);
const extraResult = await queryNeuprint(`MATCH (a:Neuron)-[e:ConnectsTo]->(b:Neuron)
WHERE a.bodyId IN [${selectedIds.join(',')}]
RETURN a.bodyId AS source, b.bodyId AS target, e.weight AS weight
ORDER BY e.weight DESC LIMIT 180`);
const edgeRows = [...(edgeResult.data || []), ...(extraResult.data || [])];
const ids = [...new Set([...edgeRows.flatMap(row => [row[0], row[1]]), ...selectedIds].filter(Number.isFinite))];
const nodeResult = await queryNeuprint(`MATCH (n:Neuron)
WHERE n.bodyId IN [${ids.join(',')}]
RETURN n.bodyId AS id, n.type AS type, n.class AS class, n.subclass AS subclass, n.pre AS pre, n.post AS post, n.predictedNt AS predictedNt`);
const nodes = (nodeResult.data || []).map(row => ({
  id: row[0], type: row[1], class: row[2], subclass: row[3], pre: row[4] || 0,
  post: row[5] || 0, nt: row[6] || 'unknown', group: groupFor(row)
}));
const valid = new Set(nodes.map(node => String(node.id)));
const edges = edgeRows.filter(row => valid.has(String(row[0])) && valid.has(String(row[1]))).map(row => ({source: row[0], target: row[1], weight: row[2] || 1}));

const selected = selectedIds.map(id => nodes.find(node => node.id === id)).filter(Boolean);
const skeletons = [];
for (const node of selected) {
  const url = `https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/${node.id}.swc`;
  const response = await fetch(url);
  if (!response.ok) continue;
  skeletons.push({id: node.id, type: node.type, group: node.group, segments: parseSwc(await response.text())});
}

const payload = {
  dataset: 'male-cns:v1.0',
  source: 'HHMI Janelia FlyEM / NeuPrint',
  license: 'CC-BY 4.0',
  nodes,
  edges,
  skeletons
};
await writeFile(output, `window.MCNS_DATA=${JSON.stringify(payload)};\n`, 'utf8');
console.log(JSON.stringify({output, nodes: nodes.length, edges: edges.length, skeletons: skeletons.length}));
