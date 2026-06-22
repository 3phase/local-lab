import {create} from 'zustand';import type {LayersModel} from '@tensorflow/tfjs';import type {Project} from '../data/datasetTypes';
type State={project:Project|null;model:LayersModel|null;setProject:(p:Project|null)=>void;patch:(p:Partial<Project>)=>void;setModel:(m:LayersModel|null)=>void};
export const useProjectStore=create<State>(set=>({project:null,model:null,setProject:project=>set({project}),patch:p=>set(s=>({project:s.project?{...s.project,...p,updatedAt:new Date().toISOString()}:null})),setModel:model=>set({model})}));
