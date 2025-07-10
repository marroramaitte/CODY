import React, { useState, useRef, useEffect } from 'react';

// Activity Bar Component
export const ActivityBar = ({ activeView, onViewChange, onChatToggle, onAIGeneratorToggle, onLiveDevelopmentToggle, onPricingToggle }) => {
  const activities = [
    { id: 'explorer', icon: '📁', title: 'Explorer' },
    { id: 'search', icon: '🔍', title: 'Search' },
    { id: 'source-control', icon: '🔀', title: 'Source Control' },
    { id: 'debug', icon: '🐛', title: 'Debug' },
    { id: 'extensions', icon: '📦', title: 'Extensions' },
    { id: 'ai-chat', icon: '🤖', title: 'AI Chat con Agentes' },
    { id: 'ai-generator', icon: '✨', title: 'AI Code Generator' },
    { id: 'pricing', icon: '💎', title: 'Planes y Precios' },
    { id: 'live-development', icon: '🚀', title: 'Live Development' }
  ];

  return (
    <div className="activity-bar">
      <div className="activity-items">
        {activities.map(activity => (
          <div
            key={activity.id}
            className={`activity-item ${activeView === activity.id ? 'active' : ''}`}
            onClick={() => {
              if (activity.id === 'ai-chat') {
                onChatToggle();
              } else if (activity.id === 'ai-generator') {
                onAIGeneratorToggle();
              } else if (activity.id === 'live-development') {
                onLiveDevelopmentToggle();
              } else if (activity.id === 'pricing') {
                onPricingToggle();
              } else {
                onViewChange(activity.id);
              }
            }}
            title={activity.title}
          >
            <span className="activity-icon">{activity.icon}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// File Explorer Component
export const FileExplorer = ({ fileSystem, onFileOpen, onFileCreate, onFolderCreate }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set(['src']));

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileSystemItem = (name, item, path = '') => {
    const fullPath = path ? `${path}/${name}` : name;
    
    if (item.type === 'folder') {
      const isExpanded = expandedFolders.has(fullPath);
      return (
        <div key={fullPath} className="file-item folder">
          <div 
            className="file-label"
            onClick={() => toggleFolder(fullPath)}
          >
            <span className="folder-icon">{isExpanded ? '📂' : '📁'}</span>
            <span className="file-name">{name}</span>
          </div>
          {isExpanded && (
            <div className="folder-contents">
              {Object.entries(item.children || {}).map(([childName, childItem]) =>
                renderFileSystemItem(childName, childItem, fullPath)
              )}
            </div>
          )}
        </div>
      );
    } else {
      const fileIcon = getFileIcon(name);
      return (
        <div 
          key={fullPath} 
          className="file-item file"
          onClick={() => onFileOpen(fullPath, item.content)}
        >
          <span className="file-icon">{fileIcon}</span>
          <span className="file-name">{name}</span>
        </div>
      );
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconMap = {
      'js': '📜',
      'jsx': '⚛️',
      'ts': '🔷',
      'tsx': '🔷',
      'css': '🎨',
      'html': '🌐',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🎨'
    };
    return iconMap[ext] || '📄';
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <span>EXPLORER</span>
        <div className="explorer-actions">
          <button title="New File">📄</button>
          <button title="New Folder">📁</button>
          <button title="Refresh">🔄</button>
        </div>
      </div>
      <div className="explorer-content">
        {Object.entries(fileSystem).map(([name, item]) =>
          renderFileSystemItem(name, item)
        )}
      </div>
    </div>
  );
};

// Search Component
export const SearchPanel = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [includeFiles, setIncludeFiles] = useState('*');
  const [excludeFiles, setExcludeFiles] = useState('');

  const mockSearchResults = [
    { file: 'src/App.js', line: 5, preview: 'function App() {' },
    { file: 'src/components/Header.js', line: 3, preview: 'const Header = () => {' },
    { file: 'src/styles/main.css', line: 2, preview: 'body {' }
  ];

  const handleSearch = () => {
    if (searchTerm.trim()) {
      setSearchResults(mockSearchResults);
    } else {
      setSearchResults([]);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-header">
        <span>SEARCH</span>
      </div>
      <div className="search-content">
        <div className="search-input-group">
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>🔍</button>
        </div>
        
        <div className="search-filters">
          <input
            type="text"
            placeholder="files to include"
            value={includeFiles}
            onChange={(e) => setIncludeFiles(e.target.value)}
          />
          <input
            type="text"
            placeholder="files to exclude"
            value={excludeFiles}
            onChange={(e) => setExcludeFiles(e.target.value)}
          />
        </div>
        
        <div className="search-results">
          {searchResults.map((result, index) => (
            <div key={index} className="search-result">
              <div className="result-file">{result.file}</div>
              <div className="result-line">Line {result.line}: {result.preview}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Source Control Component
export const SourceControlPanel = () => {
  const [changes, setChanges] = useState([
    { file: 'src/App.js', status: 'M' },
    { file: 'src/components/Header.js', status: 'A' },
    { file: 'src/styles/main.css', status: 'M' }
  ]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'M': return '📝';
      case 'A': return '➕';
      case 'D': return '➖';
      case 'U': return '❓';
      default: return '📄';
    }
  };

  return (
    <div className="source-control-panel">
      <div className="source-control-header">
        <span>SOURCE CONTROL</span>
      </div>
      <div className="source-control-content">
        <div className="commit-section">
          <textarea placeholder="Message (press Ctrl+Enter to commit)" />
          <button className="commit-button">✓ Commit</button>
        </div>
        
        <div className="changes-section">
          <div className="changes-header">Changes</div>
          {changes.map((change, index) => (
            <div key={index} className="change-item">
              <span className="change-status">{getStatusIcon(change.status)}</span>
              <span className="change-file">{change.file}</span>
              <div className="change-actions">
                <button title="Stage Changes">+</button>
                <button title="Discard Changes">↶</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Extensions Component
export const ExtensionsPanel = () => {
  const [extensions] = useState([
    { name: 'AI Code Assistant', installed: true, rating: 4.9 },
    { name: 'Error Lens', installed: true, rating: 4.8 },
    { name: 'Auto Complete Pro', installed: false, rating: 4.7 },
    { name: 'Code Formatter', installed: true, rating: 4.6 },
    { name: 'Deep Error Detection', installed: false, rating: 4.5 }
  ]);

  return (
    <div className="extensions-panel">
      <div className="extensions-header">
        <span>EXTENSIONS</span>
        <button title="Install from VSIX">📦</button>
      </div>
      <div className="extensions-content">
        <div className="extensions-search">
          <input type="text" placeholder="Search Extensions in Marketplace" />
        </div>
        
        <div className="extensions-list">
          {extensions.map((ext, index) => (
            <div key={index} className="extension-item">
              <div className="extension-info">
                <div className="extension-name">{ext.name}</div>
                <div className="extension-rating">⭐ {ext.rating}</div>
              </div>
              <button className={`extension-action ${ext.installed ? 'uninstall' : 'install'}`}>
                {ext.installed ? 'Uninstall' : 'Install'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Sidebar Component
export const SideBar = ({ activeView, fileSystem, onFileOpen, width, onWidthChange, errors, onErrorClick }) => {
  const sidebarRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        onWidthChange(newWidth);
      }
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const renderView = () => {
    switch (activeView) {
      case 'explorer':
        return <FileExplorer fileSystem={fileSystem} onFileOpen={onFileOpen} />;
      case 'search':
        return <SearchPanel />;
      case 'source-control':
        return <SourceControlPanel />;
      case 'extensions':
        return <ExtensionsPanel />;
      default:
        return <FileExplorer fileSystem={fileSystem} onFileOpen={onFileOpen} />;
    }
  };

  return (
    <div 
      ref={sidebarRef}
      className="sidebar" 
      style={{ width: `${width}px` }}
    >
      {renderView()}
      <div 
        className="sidebar-resizer"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

// Code Editor Component
export const Editor = ({ 
  openFiles, 
  activeTab, 
  selectedFile, 
  onTabChange, 
  onFileClose, 
  onContentChange, 
  onCursorChange, 
  completions, 
  onCompletionRequest, 
  errors 
}) => {
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [showCompletions, setShowCompletions] = useState(false);
  const textareaRef = useRef(null);

  const handleCodeChange = (e) => {
    const content = e.target.value;
    if (activeTab && selectedFile) {
      onContentChange(activeTab, content);
    }
  };

  const handleCursorMove = (e) => {
    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    const lines = textarea.value.substring(0, cursorPos).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    setCursorPosition({ line, column });
    onCursorChange({ line, column });
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault();
      setShowCompletions(true);
      onCompletionRequest(selectedFile?.content || '', cursorPosition);
    }
  };

  const renderTabs = () => {
    if (openFiles.length === 0) return null;

    return (
      <div className="editor-tabs">
        {openFiles.map(file => (
          <div 
            key={file.path}
            className={`tab ${activeTab === file.path ? 'active' : ''}`}
            onClick={() => onTabChange(file.path)}
          >
            <span className="tab-icon">{getFileIcon(file.path)}</span>
            <span className="tab-name">{file.path.split('/').pop()}</span>
            {file.modified && <span className="tab-modified">●</span>}
            <button 
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(file.path);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconMap = {
      'js': '📜',
      'jsx': '⚛️',
      'ts': '🔷',
      'tsx': '🔷',
      'css': '🎨',
      'html': '🌐',
      'json': '📋',
      'md': '📝'
    };
    return iconMap[ext] || '📄';
  };

  const renderLineNumbers = () => {
    if (!selectedFile) return null;
    
    const lines = selectedFile.content.split('\n');
    return (
      <div className="line-numbers">
        {lines.map((_, index) => (
          <div key={index} className="line-number">
            {index + 1}
          </div>
        ))}
      </div>
    );
  };

  const renderErrorMarkers = () => {
    if (!errors || errors.length === 0) return null;
    
    return (
      <div className="error-markers">
        {errors.map((error, index) => (
          <div 
            key={index} 
            className={`error-marker ${error.severity}`}
            style={{ top: `${error.line * 20}px` }}
            title={error.message}
          />
        ))}
      </div>
    );
  };

  if (openFiles.length === 0) {
    return (
      <div className="editor-container">
        <div className="editor-welcome">
          <div className="welcome-content">
            <h2>Welcome to VSCode Clone</h2>
            <p>Open a file to start editing</p>
            <div className="welcome-actions">
              <button>📄 New File</button>
              <button>📁 Open Folder</button>
              <button>🔍 Find in Files</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      {renderTabs()}
      
      <div className="editor-content">
        <div className="editor-gutter">
          {renderLineNumbers()}
          {renderErrorMarkers()}
        </div>
        
        <div className="editor-main">
          <textarea
            ref={textareaRef}
            className="code-editor"
            value={selectedFile?.content || ''}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            onMouseUp={handleCursorMove}
            onKeyUp={handleCursorMove}
            spellCheck={false}
            placeholder="Start typing your code..."
          />
          
          {showCompletions && (
            <div className="completions-popup">
              {completions.map((completion, index) => (
                <div key={index} className="completion-item">
                  <span className="completion-text">{completion.text}</span>
                  <span className="completion-detail">{completion.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="editor-minimap">
          <div className="minimap-content">
            {selectedFile?.content.split('\n').map((line, index) => (
              <div key={index} className="minimap-line" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Terminal Component
export const Terminal = ({ height, onHeightChange, onClose }) => {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState([
    { type: 'output', text: 'Welcome to VSCode Clone Terminal' },
    { type: 'output', text: 'Type "help" for available commands' }
  ]);
  const [isResizing, setIsResizing] = useState(false);

  const mockCommands = {
    'help': 'Available commands: ls, pwd, clear, npm, git, help',
    'ls': 'src/  public/  package.json  README.md',
    'pwd': '/workspace/my-app',
    'clear': '',
    'npm start': 'Starting development server...',
    'npm install': 'Installing dependencies...',
    'git status': 'On branch main\nChanges not staged for commit:\n  modified: src/App.js',
    'git add .': 'Files staged for commit',
    'git commit -m': 'Commit created successfully'
  };

  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      const newOutput = [...output, { type: 'command', text: `$ ${command}` }];
      
      if (command.trim() === 'clear') {
        setOutput([]);
      } else if (mockCommands[command]) {
        newOutput.push({ type: 'output', text: mockCommands[command] });
      } else if (command.trim()) {
        newOutput.push({ type: 'output', text: `Command not found: ${command}` });
      }
      
      setOutput(newOutput);
      setCommand('');
    }
  };

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (isResizing) {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= 100 && newHeight <= 400) {
        onHeightChange(newHeight);
      }
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="terminal-container" style={{ height: `${height}px` }}>
      <div className="terminal-resizer" onMouseDown={handleMouseDown} />
      
      <div className="terminal-header">
        <div className="terminal-tabs">
          <div className="terminal-tab active">
            <span>Terminal</span>
            <button onClick={onClose}>×</button>
          </div>
        </div>
        <div className="terminal-actions">
          <button title="Split Terminal">⚡</button>
          <button title="New Terminal">+</button>
        </div>
      </div>
      
      <div className="terminal-content">
        {output.map((line, index) => (
          <div key={index} className={`terminal-line ${line.type}`}>
            {line.text}
          </div>
        ))}
        
        <div className="terminal-input">
          <span className="terminal-prompt">$ </span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyPress={handleCommand}
            placeholder="Type a command..."
            autoFocus
          />
        </div>
      </div>
    </div>
  );
};

// Status Bar Component
export const StatusBar = ({ selectedFile, cursorPosition, errors, onTerminalToggle }) => {
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-item">
          <span className="status-icon">🔀</span>
          <span>main</span>
        </div>
        
        <div className="status-item" onClick={onTerminalToggle}>
          <span className="status-icon">🚨</span>
          <span>{errorCount} errors</span>
          <span>{warningCount} warnings</span>
        </div>
      </div>
      
      <div className="status-right">
        <div className="status-item">
          <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
        </div>
        
        <div className="status-item">
          <span>UTF-8</span>
        </div>
        
        <div className="status-item">
          <span>LF</span>
        </div>
        
        <div className="status-item">
          <span>{selectedFile ? getLanguage(selectedFile.path) : 'Plain Text'}</span>
        </div>
        
        <div className="status-item">
          <span className="status-icon">🔔</span>
        </div>
      </div>
    </div>
  );
};

const getLanguage = (filePath) => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap = {
    'js': 'JavaScript',
    'jsx': 'JavaScript React',
    'ts': 'TypeScript',
    'tsx': 'TypeScript React',
    'css': 'CSS',
    'html': 'HTML',
    'json': 'JSON',
    'md': 'Markdown'
  };
  return languageMap[ext] || 'Plain Text';
};

// ChatBot Component
export const ChatBot = ({ onClose, currentCode }) => {
  const [messages, setMessages] = useState([
    { type: 'bot', text: 'Hello! I\'m your AI coding assistant. I can help you with code review, debugging, and suggestions.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      const newMessages = [...messages, { type: 'user', text: inputMessage }];
      setMessages(newMessages);
      setInputMessage('');
      setIsTyping(true);

      // Simulate AI response
      setTimeout(() => {
        const responses = [
          "I can help you improve this code. Would you like me to analyze it for potential issues?",
          "This looks good! I notice you could add some error handling here.",
          "Great question! Let me suggest some improvements for better performance.",
          "I can help you refactor this code to make it more maintainable."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        setMessages([...newMessages, { type: 'bot', text: randomResponse }]);
        setIsTyping(false);
      }, 1500);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <span>🤖 AI Assistant</span>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="chatbot-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.type}`}>
            <div className="message-content">
              {message.text}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="message bot">
            <div className="message-content typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
      
      <div className="chatbot-input">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything about your code..."
          rows="3"
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
};

// Code Completion Modal
export const CodeCompletionModal = ({ completions, onClose }) => {
  return (
    <div className="completion-modal">
      <div className="completion-header">
        <span>Code Completions</span>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="completion-list">
        {completions.map((completion, index) => (
          <div key={index} className="completion-item">
            <span className="completion-text">{completion.text}</span>
            <span className="completion-detail">{completion.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Error Panel Component
export const ErrorPanel = ({ errors, onClose }) => {
  return (
    <div className="error-panel">
      <div className="error-header">
        <span>🚨 Problems ({errors.length})</span>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="error-list">
        {errors.map((error, index) => (
          <div key={index} className={`error-item ${error.severity}`}>
            <span className="error-icon">
              {error.severity === 'error' ? '❌' : error.severity === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div className="error-details">
              <div className="error-message">{error.message}</div>
              <div className="error-location">Line {error.line}, Column {error.column}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// AI Code Generator Component
export const AICodeGenerator = ({ onClose, onCodeGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (prompt.trim()) {
      setIsGenerating(true);
      
      // Simulate AI code generation
      setTimeout(() => {
        const mockCode = `// Generated code based on: "${prompt}"\n\nfunction ${prompt.replace(/\s+/g, '')}() {\n  // TODO: Implement functionality\n  console.log('Generated from AI');\n  \n  return {\n    success: true,\n    message: 'Code generated successfully'\n  };\n}\n\nexport default ${prompt.replace(/\s+/g, '')};`;
        
        setGeneratedCode(mockCode);
        setIsGenerating(false);
      }, 2000);
    }
  };

  const handleAccept = () => {
    if (generatedCode) {
      onCodeGenerated(generatedCode);
      onClose();
    }
  };

  return (
    <div className="ai-generator-container">
      <div className="ai-generator-header">
        <span>✨ AI Code Generator</span>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="ai-generator-content">
        <div className="generator-input">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create (e.g., 'React component for user login form')"
            rows="4"
          />
          <button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Code'}
          </button>
        </div>
        
        {isGenerating && (
          <div className="generating-indicator">
            <span>🤖 AI is generating your code...</span>
          </div>
        )}
        
        {generatedCode && (
          <div className="generated-code">
            <div className="code-header">
              <span>Generated Code:</span>
              <div className="code-actions">
                <button onClick={handleAccept}>Accept</button>
                <button onClick={() => setGeneratedCode('')}>Reject</button>
              </div>
            </div>
            <pre className="code-preview">{generatedCode}</pre>
          </div>
        )}
      </div>
    </div>
  );
};