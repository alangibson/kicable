import type { FC } from 'react';
import { storage } from './storage/index.js';
import ProjectListScreen from './projects/ProjectListScreen.js';

const App: FC = () => {
  return <ProjectListScreen storage={storage} />;
};

export default App;
