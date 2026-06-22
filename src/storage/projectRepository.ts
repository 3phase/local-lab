import {openDB} from 'idb';
import type {Dataset,Project} from '../data/datasetTypes';

type StoredDataset=Dataset&{projectId:string};
const knownDatasets=new Set<string>();
const db=()=>openDB('locallab',2,{upgrade(d){if(!d.objectStoreNames.contains('projects'))d.createObjectStore('projects',{keyPath:'id'});if(!d.objectStoreNames.contains('datasets'))d.createObjectStore('datasets',{keyPath:'projectId'})}});

export async function saveProject(p:Project){
  const database=await db();
  const tx=database.transaction(['projects','datasets'],'readwrite');
  if(!knownDatasets.has(p.id)){
    await tx.objectStore('datasets').put({...p.dataset,projectId:p.id} satisfies StoredDataset);
    knownDatasets.add(p.id);
  }
  await tx.objectStore('projects').put({...p,dataset:{...p.dataset,rows:[],rawRows:undefined},updatedAt:new Date().toISOString()});
  await tx.done;
}

export async function getProject(id:string){
  const database=await db();
  const [project,dataset]=await Promise.all([database.get('projects',id) as Promise<Project|undefined>,database.get('datasets',id) as Promise<StoredDataset|undefined>]);
  if(!project)return undefined;
  if(dataset){knownDatasets.add(id);return{...project,dataset} as Project}
  return project;
}

export async function listProjects(){
  const projects=await (await db()).getAll('projects') as Project[];
  return Promise.all(projects.map(async p=>(await getProject(p.id))??p));
}
