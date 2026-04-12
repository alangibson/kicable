import { useState, type FC } from 'react';
import type { Project } from '@kicable/shared';
import { storage } from './storage/index.js';
import ProjectListScreen from './projects/ProjectListScreen.js';
import SchematicEditor from './schematic/SchematicEditor.js';
import ComponentLibraryScreen from './library/ComponentLibraryScreen.js';

type Screen = 'projects' | 'library';

const App: FC = () => {
  const [screen, setScreen] = useState<Screen>('projects');
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

  if (screen === 'library') {
    return (
      <ComponentLibraryScreen
        storage={storage}
        onClose={() => setScreen('projects')}
      />
    );
  }

  return (
    <ProjectListScreen
      storage={storage}
      onOpenProject={setOpenProject}
      onOpenLibrary={() => setScreen('library')}
    />
  );
};

export default App;
