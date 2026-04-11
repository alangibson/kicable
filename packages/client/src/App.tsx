import { useState, type FC } from 'react';
import type { Project } from '@kicable/shared';
import { storage } from './storage/index.js';
import ProjectListScreen from './projects/ProjectListScreen.js';
import SchematicEditor from './schematic/SchematicEditor.js';

const App: FC = () => {
  const [openProject, setOpenProject] = useState<Project | null>(null);

  if (openProject) {
    return (
      <SchematicEditor
        project={openProject}
        storage={storage}
        onClose={() => setOpenProject(null)}
      />
    );
  }

  return (
    <ProjectListScreen
      storage={storage}
      onOpenProject={setOpenProject}
    />
  );
};

export default App;
