import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  ActivityBar, 
  SideBar, 
  Editor, 
  Terminal, 
  StatusBar, 
  CodeCompletionModal,
  ErrorPanel,
  AICodeGenerator
} from './components';
import LiveDevelopmentSystem from './LiveDevelopment';
import EnhancedChatBot from './EnhancedChatBot';
import PricingPanel from './PricingPanel';

function App() {
  const [activeView, setActiveView] = useState('explorer');
  const [selectedFile, setSelectedFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [chatBotVisible, setChatBotVisible] = useState(false);
  const [codeCompletionVisible, setCodeCompletionVisible] = useState(false);
  const [errorPanelVisible, setErrorPanelVisible] = useState(false);
  const [aiGeneratorVisible, setAiGeneratorVisible] = useState(false);
  const [liveDevelopmentVisible, setLiveDevelopmentVisible] = useState(false);
  const [pricingVisible, setPricingVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [currentCode, setCurrentCode] = useState('');
  const [errors, setErrors] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Mock file system
  const [fileSystem] = useState({
    'src': {
      'type': 'folder',
      'children': {
        'App.js': { type: 'file', content: '// Welcome to VSCode Clone\nimport React from "react";\n\nfunction App() {\n  return (\n    <div className="App">\n      <h1>Hello World!</h1>\n    </div>\n  );\n}\n\nexport default App;' },
        'components': {
          'type': 'folder',
          'children': {
            'Header.js': { type: 'file', content: '// Header Component\nimport React from "react";\n\nconst Header = () => {\n  return <header>My App</header>;\n};\n\nexport default Header;' },
            'Footer.js': { type: 'file', content: '// Footer Component\nimport React from "react";\n\nconst Footer = () => {\n  return <footer>© 2025 My App</footer>;\n};\n\nexport default Footer;' }
          }
        },
        'styles': {
          'type': 'folder',
          'children': {
            'main.css': { type: 'file', content: '/* Main styles */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 0;\n}\n\n.container {\n  max-width: 1200px;\n  margin: 0 auto;\n}' },
            'components.css': { type: 'file', content: '/* Component styles */\n.header {\n  background: #333;\n  color: white;\n  padding: 1rem;\n}\n\n.footer {\n  background: #666;\n  color: white;\n  padding: 0.5rem;\n  text-align: center;\n}' }
          }
        }
      }
    },
    'public': {
      'type': 'folder',
      'children': {
        'index.html': { type: 'file', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My App</title>\n</head>\n<body>\n    <div id="root"></div>\n</body>\n</html>' }
      }
    },
    'package.json': { type: 'file', content: '{\n  "name": "my-app",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  },\n  "scripts": {\n    "start": "react-scripts start",\n    "build": "react-scripts build",\n    "test": "react-scripts test"\n  }\n}' },
    'README.md': { type: 'file', content: '# My React App\n\nThis is a sample React application.\n\n## Getting Started\n\n1. Install dependencies: `npm install`\n2. Start the development server: `npm start`\n3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.\n\n## Features\n\n- React 18\n- Modern JavaScript\n- Responsive design\n\n## Contributing\n\nFeel free to submit issues and pull requests!' }
  });

  const openFile = (path, content) => {
    const existingFile = openFiles.find(f => f.path === path);
    if (!existingFile) {
      const newFile = { path, content, modified: false };
      setOpenFiles([...openFiles, newFile]);
      setActiveTab(path);
      setSelectedFile(newFile);
      setCurrentCode(content);
    } else {
      setActiveTab(path);
      setSelectedFile(existingFile);
      setCurrentCode(existingFile.content);
    }
  };

  const closeFile = (path) => {
    const updatedFiles = openFiles.filter(f => f.path !== path);
    setOpenFiles(updatedFiles);
    
    if (activeTab === path) {
      if (updatedFiles.length > 0) {
        const newActiveFile = updatedFiles[updatedFiles.length - 1];
        setActiveTab(newActiveFile.path);
        setSelectedFile(newActiveFile);
        setCurrentCode(newActiveFile.content);
      } else {
        setActiveTab(null);
        setSelectedFile(null);
        setCurrentCode('');
      }
    }
  };

  const updateFileContent = (path, newContent) => {
    const updatedFiles = openFiles.map(file => 
      file.path === path 
        ? { ...file, content: newContent, modified: true }
        : file
    );
    setOpenFiles(updatedFiles);
    setCurrentCode(newContent);
  };

  // AI Code Analysis
  const analyzeCode = (code) => {
    const mockErrors = [
      { line: 5, column: 10, message: 'Missing semicolon', severity: 'error' },
      { line: 8, column: 15, message: 'Unused variable "temp"', severity: 'warning' },
      { line: 12, column: 5, message: 'Consider using const instead of let', severity: 'info' }
    ];
    setErrors(mockErrors);
  };

  const generateCompletions = (code, position) => {
    const mockCompletions = [
      { text: 'console.log', detail: 'Console logging function' },
      { text: 'useState', detail: 'React Hook for state management' },
      { text: 'useEffect', detail: 'React Hook for side effects' },
      { text: 'className', detail: 'CSS class attribute' },
      { text: 'onClick', detail: 'Click event handler' }
    ];
    setCompletions(mockCompletions);
  };

  useEffect(() => {
    if (currentCode) {
      analyzeCode(currentCode);
    }
  }, [currentCode]);

  const handleKeyDown = (e) => {
    // Command palette
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      // Open command palette
    }
    
    // AI Code Generator
    if (e.ctrlKey && e.shiftKey && e.key === 'G') {
      e.preventDefault();
      setAiGeneratorVisible(true);
    }
    
    // Toggle terminal
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      setTerminalVisible(!terminalVisible);
    }

    // Toggle Live Development
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      setLiveDevelopmentVisible(!liveDevelopmentVisible);
    }

    // Toggle Pricing Panel
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      setPricingVisible(!pricingVisible);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [terminalVisible, liveDevelopmentVisible, pricingVisible]);

  // Si está visible el sistema de desarrollo en vivo, mostrarlo en pantalla completa
  if (liveDevelopmentVisible) {
    return (
      <div className="fullscreen-overlay">
        <div className="live-dev-header">
          <button 
            onClick={() => setLiveDevelopmentVisible(false)}
            className="close-live-dev"
          >
            ← Volver al VSCode
          </button>
        </div>
        <LiveDevelopmentSystem />
      </div>
    );
  }

  return (
    <div className="vscode-container" onKeyDown={handleKeyDown}>
      <div className="vscode-layout">
        <ActivityBar 
          activeView={activeView}
          onViewChange={setActiveView}
          onChatToggle={() => setChatBotVisible(!chatBotVisible)}
          onAIGeneratorToggle={() => setAiGeneratorVisible(!aiGeneratorVisible)}
          onLiveDevelopmentToggle={() => setLiveDevelopmentVisible(!liveDevelopmentVisible)}
        />
        
        <SideBar 
          activeView={activeView}
          fileSystem={fileSystem}
          onFileOpen={openFile}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          errors={errors}
          onErrorClick={() => setErrorPanelVisible(!errorPanelVisible)}
        />
        
        <div className="main-content">
          <Editor 
            openFiles={openFiles}
            activeTab={activeTab}
            selectedFile={selectedFile}
            onTabChange={setActiveTab}
            onFileClose={closeFile}
            onContentChange={updateFileContent}
            onCursorChange={setCursorPosition}
            completions={completions}
            onCompletionRequest={generateCompletions}
            errors={errors}
          />
          
          {terminalVisible && (
            <Terminal 
              height={terminalHeight}
              onHeightChange={setTerminalHeight}
              onClose={() => setTerminalVisible(false)}
            />
          )}
        </div>
      </div>
      
      <StatusBar 
        selectedFile={selectedFile}
        cursorPosition={cursorPosition}
        errors={errors}
        onTerminalToggle={() => setTerminalVisible(!terminalVisible)}
      />
      
      {chatBotVisible && (
        <EnhancedChatBot 
          onClose={() => setChatBotVisible(false)}
          currentCode={currentCode}
        />
      )}
      
      {codeCompletionVisible && (
        <CodeCompletionModal 
          completions={completions}
          onClose={() => setCodeCompletionVisible(false)}
        />
      )}
      
      {errorPanelVisible && (
        <ErrorPanel 
          errors={errors}
          onClose={() => setErrorPanelVisible(false)}
        />
      )}
      
      {aiGeneratorVisible && (
        <AICodeGenerator 
          onClose={() => setAiGeneratorVisible(false)}
          onCodeGenerated={(code) => updateFileContent(activeTab, code)}
        />
      )}
    </div>
  );
}

export default App;