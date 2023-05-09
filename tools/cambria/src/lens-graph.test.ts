import { TypeName } from 'json-schema-typed/draft-07';

import { addProperty, inside, hoistProperty } from './helpers.js';
import { ILensGraph, initLensGraph, registerLens, lensGraphSchemas, lensFromTo } from './lens-graph.js';

const LensMutoV1 = [addProperty({ name: 'title', type: TypeName.String })];
const LensV1toV2 = [
  addProperty({ name: 'metadata', type: TypeName.Object }),
  inside('metadata', [
    addProperty({ name: 'createdAt', type: TypeName.Number }),
    addProperty({ name: 'updatedAt', type: TypeName.Number })
  ])
];
const LensV2toV3 = [
  hoistProperty('metadata', 'createdAt'),
  addProperty({ name: 'metadata', type: TypeName.Object })
];

const Lenses = [
  { from: 'mu', to: 'V1', lens: LensMutoV1 },
  { from: 'V1', to: 'V2', lens: LensV1toV2 },
  { from: 'V2', to: 'V3', lens: LensV2toV3 }
];

describe('registering lenses', () => {
  it('should be able to create a graph', () => {
    const graph = initLensGraph();
    expect(lensGraphSchemas(graph)).toEqual(['mu']);
  });

  it('should be able to register some lenses', () => {
    const graph = Lenses.reduce<ILensGraph>((graph, { from, to, lens }) => {
      return registerLens(graph, from, to, lens);
    }, initLensGraph());
    expect(lensGraphSchemas(graph)).toEqual(['mu', 'V1', 'V2', 'V3']);
  });

  it('should compose a lens from a path', () => {
    const graph = Lenses.reduce<ILensGraph>(
      (graph, { from, to, lens }) => registerLens(graph, from, to, lens),
      initLensGraph()
    );

    const lens = lensFromTo(graph, 'V1', 'V3');
    expect(lens).toEqual([...LensV1toV2, ...LensV2toV3]);
  });
});
