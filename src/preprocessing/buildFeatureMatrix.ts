import type { ColumnProfile, TaskType } from '../data/datasetTypes';
import { fitScaler, scale, type StandardScalerState } from './StandardScaler';
import { fitOneHot, oneHot, type OneHotEncoderState } from './OneHotEncoder';
import { fitLabels, type LabelEncoderState } from './LabelEncoder';

export type PreprocessingState = {
  scalers: Record<string, StandardScalerState>;
  encoders: Record<string, OneHotEncoderState>;
  booleanModes: Record<string, number>;
  labelEncoder: LabelEncoderState | null;
  featureVector: { size: number; names: string[] }
};
const boolean = (v: unknown) => ['true', 'yes', 'y', '1'].includes(String(v).toLowerCase()) ? 1 : ['false', 'no', 'n', '0'].includes(String(v).toLowerCase()) ? 0 : null;

export function fitPreprocessing(rows: Record<string, unknown>[], features: ColumnProfile[], target: ColumnProfile, task: TaskType) {
  const state: PreprocessingState = {
    scalers: {},
    encoders: {},
    booleanModes: {},
    labelEncoder: task === 'regression' ? null : fitLabels(rows.map(r => r[target.name])),
    featureVector: {size: 0, names: []}
  };
  for (const f of features) {
    if (f.selectedType === 'number') {
      state.scalers[f.name] = fitScaler(f.name, rows.map(r => r[f.name]));
      state.featureVector.names.push(f.name)
    } else if (f.selectedType === 'boolean') {
      const vs = rows.map(r => boolean(r[f.name])).filter(x => x !== null) as (0 | 1)[];
      state.booleanModes[f.name] = vs.filter(Boolean).length >= vs.length / 2 ? 1 : 0;
      state.featureVector.names.push(f.name)
    } else {
      const enc = fitOneHot(f.name, rows.map(r => r[f.name]));
      state.encoders[f.name] = enc;
      state.featureVector.names.push(...enc.labels.map(x => `${f.name}=${x}`))
    }
  }
  state.featureVector.size = state.featureVector.names.length;
  return state
}

export function transformRows(rows: Record<string, unknown>[], features: ColumnProfile[], state: PreprocessingState) {
  return rows.map(r => features.flatMap(f => state.scalers[f.name] ? [scale(r[f.name], state.scalers[f.name])] : state.encoders[f.name] ? oneHot(r[f.name], state.encoders[f.name]) : [boolean(r[f.name]) ?? state.booleanModes[f.name] ?? 0]))
}

export function transformTargets(rows: Record<string, unknown>[], target: string, task: TaskType, state: PreprocessingState) {
  return rows.map(r => task === 'regression' ? Number(r[target]) : state.labelEncoder!.labelToIndex[String(r[target])])
}
