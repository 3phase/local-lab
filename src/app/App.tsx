import { Route, Routes } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';
import { NewDatasetPage } from '../pages/NewDatasetPage';
import { ProjectPage } from '../pages/ProjectPage';
import { ImportModelPage } from '../pages/ImportModelPage';
import { PredictPage } from '../pages/PredictPage';

export function App() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/new-dataset"
                                                                    element={<NewDatasetPage />} /><Route
    path="/project/:projectId" element={<ProjectPage />} /><Route path="/model/local/:projectId"
                                                                  element={<ProjectPage />} /><Route
    path="/model/import" element={<ImportModelPage />} /><Route path="/predict/:projectId"
                                                                element={<PredictPage />} /><Route path="*"
                                                                                                   element={<main
                                                                                                     className="center">
                                                                                                     <h1>That page
                                                                                                       wandered
                                                                                                       off.</h1><a
                                                                                                     href="/">Return
                                                                                                     home</a></main>} /></Routes>
}
