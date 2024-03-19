import pkg, { Graph } from 'graphlib';
import { JSONSchema } from 'json-schema-typed/draft-07';

import { emptySchema } from './json-schema.js';

import { LensSource, LensOp, updateSchema, reverseLens } from './index.js';

const { alg, json } = pkg;

export interface ILensGraph {
  graph: Graph;
}

export function initLensGraph(schema?: JSONSchema.Interface): ILensGraph {
  const lensGraph: ILensGraph = { graph: new Graph() };

  lensGraph.graph.setNode('mu', schema || emptySchema);
  return lensGraph;
}

// Add a new lens to the schema graph.
// If the "to" schema doesn't exist yet, registers the schema too.
// Returns a copy of the graph with the new contents.
export function registerLens(
  { graph }: ILensGraph,
  from: string,
  to: string,
  lenses: LensSource
): ILensGraph {
  // clone the graph to ensure this is a pure function
  graph = json.read(json.write(graph)); // (these are graphlib's jsons)

  if (!graph.node(from)) {
    throw new RangeError(`unknown schema ${from}`);
  }

  const existingLens = graph.edge({ v: from, w: to });
  if (existingLens) {
    // we could assert this? assert.deepEqual(existingLens, lenses)
    // we've already registered a lens on this edge, hope it's the same one!
    // todo: maybe warn here? seems dangerous to silently return...
    return { graph };
  }

  if (!graph.node(to)) {
    graph.setNode(to, updateSchema(graph.node(from), lenses));
  }

  graph.setEdge(from, to, lenses);
  graph.setEdge(to, from, reverseLens(lenses));

  return { graph };
}

export function lensGraphSchemas({ graph }: ILensGraph): string[] {
  return graph.nodes();
}

export function lensGraphSchema({ graph }: ILensGraph, schema: string): JSONSchema.Object {
  return graph.node(schema);
}

export function lensFromTo({ graph }: ILensGraph, from: string, to: string): LensSource {
  if (!graph.hasNode(from)) {
    throw new Error(`couldn't find schema in graph: ${from}`);
  }

  if (!graph.hasNode(to)) {
    throw new Error(`couldn't find schema in graph: ${to}`);
  }

  const migrationPaths = alg.dijkstra(graph, to);
  const lenses: LensOp[] = [];
  if (migrationPaths[from].distance === Infinity) {
    throw new Error(`no path found from ${from} to ${to}`);
  }
  if (migrationPaths[from].distance === 0) {
    return [];
  }
  for (let v = from; v !== to; v = migrationPaths[v].predecessor) {
    const w = migrationPaths[v].predecessor;
    const edge = graph.edge({ v, w });
    lenses.push(...edge);
  }
  return lenses;
}
