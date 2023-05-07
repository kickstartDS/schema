import YAML from 'js-yaml';

import { LensSource, LensOp } from './lens-ops.js';

interface IYAMLLens {
  lens: LensSource;
}

const foldInOp = (lensOpJson: { [key: string]: any }): LensOp => {
  const opName = Object.keys(lensOpJson)[0];

  // the json format isJSONSchema7
  // {"<opName>": {opArgs}}
  // and the internal format is
  // {op: <opName>, ...opArgs}
  const data = lensOpJson[opName];
  if (['in', 'map'].includes(opName)) {
    data.lens = data.lens.map((lensOp: { [key: string]: any }) => foldInOp(lensOp));
  }

  const op = { op: opName, ...data };
  return op;
};

export function loadLens(rawLens: IYAMLLens): LensSource {
  return (rawLens.lens as LensSource).filter((o) => o !== null).map((lensOpJson) => foldInOp(lensOpJson));
}

export function loadYamlLens(lensData: string): LensSource {
  const rawLens = YAML.load(lensData) as IYAMLLens;
  if (!rawLens || typeof rawLens !== 'object') throw new Error('Error loading lens');
  if (!('lens' in rawLens)) throw new Error(`Expected top-level key 'lens' in YAML lens file`);

  // we could have a root op to make this consistent...
  return loadLens(rawLens);
}
