import { DirectedEdge, DirectedGraph, DirectedVertex } from 'directed-graph-typed';
import { JSONSchema } from 'json-schema-typed/draft-07';

export type VertexKey = string | number;
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

export class SchemaEdge<E = unknown> extends DirectedEdge<E> {
  private _data: E | undefined;

  public constructor(v1: VertexKey, v2: VertexKey, weight?: number, val?: E) {
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

export class SchemaDirectedGraph<V = JSONSchema.Interface, E = unknown> extends DirectedGraph<V, E> {
  public constructor(vertices?: SchemaVertex<V>[], edges?: SchemaEdge<E>[]) {
    super();

    for (const vertex of vertices || []) {
      this.addVertex(vertex);
    }
    for (const edge of edges || []) {
      this.addEdge(edge);
    }
  }
}
