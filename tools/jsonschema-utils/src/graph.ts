import { DirectedEdge, DirectedGraph, DirectedVertex } from 'directed-graph-typed';
import { JSONSchema } from 'json-schema-typed/draft-07';

export type VertexKey = string | number;
export type IEdgeData = [
  {
    refOrigin: string;
    refTarget: string;
  }
];
export class SchemaVertex<V = JSONSchema.Interface> extends DirectedVertex<V> {
  private _data: V | undefined;

  public constructor(key: VertexKey, val?: V) {
    super(key, val);
    this._data = val;
  }

  public get data(): V | undefined {
    return this._data;
  }

  public set data(value: V | undefined) {
    this._data = value;
  }
}

export class SchemaEdge<E = IEdgeData> extends DirectedEdge<E> {
  private _data: E | undefined;

  public constructor(v1: VertexKey, v2: VertexKey, val?: E, weight?: number) {
    super(v1, v2, weight, val);
    this._data = val;
  }

  public get data(): E | undefined {
    return this._data;
  }

  public set data(value: E | undefined) {
    this._data = value;
  }
}

export class SchemaDirectedGraph<V = JSONSchema.Interface, E = IEdgeData> extends DirectedGraph<
  V,
  E,
  SchemaVertex<V>,
  SchemaEdge<E>
> {
  public constructor(vertices?: SchemaVertex<V>[], edges?: SchemaEdge<E>[]) {
    super();

    for (const vertex of vertices || []) {
      this.addVertex(vertex);
    }
    for (const edge of edges || []) {
      this.addEdge(edge);
    }
  }

  public getEdge(
    srcOrKey: SchemaVertex<V> | VertexKey | undefined,
    destOrKey: SchemaVertex<V> | VertexKey | undefined
  ): SchemaEdge<E> | undefined {
    return super.getEdge(srcOrKey, destOrKey);
  }

  public getVertex(vertexKey: VertexKey): SchemaVertex<V> | undefined {
    return super.getVertex(vertexKey);
  }

  public getSubGraphStartingFrom(vertexKey: VertexKey): SchemaDirectedGraph<V, E> {
    const connectedGraph = new SchemaDirectedGraph<V, E>();
    const visited: Set<VertexKey> = new Set();
    const queue: VertexKey[] = [vertexKey];

    while (queue.length > 0) {
      const currentKey = queue.shift();
      if (currentKey && !visited.has(currentKey)) {
        visited.add(currentKey);
        const currentVertex = this.getVertex(currentKey);
        if (currentVertex) {
          connectedGraph.addVertex(currentVertex);
          for (const edge of this.edgesOf(currentKey)) {
            connectedGraph.addEdge(edge);
            if (!visited.has(edge.dest)) {
              queue.push(edge.dest);
            }
          }
        }
      }
    }

    return connectedGraph;
  }
}
