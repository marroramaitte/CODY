import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Componente principal del sistema de desarrollo en vivo
export const LiveDevelopmentSystem = () => {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState('react_app');
  const [liveEvents, setLiveEvents] = useState([]);
  const messagesEndRef = useRef(null);

  // Conectar WebSocket al montar el componente
  useEffect(() => {
    connectWebSocket();
    loadProjects();
    
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  // Auto-scroll para los eventos
  useEffect(() => {
    scrollToBottom();
  }, [liveEvents]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const connectWebSocket = () => {
    const wsUrl = BACKEND_URL.replace('http', 'ws') + '/api/ws/live';
    console.log('Conectando a WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket conectado');
      setConnectionStatus('connected');
      setWsConnection(ws);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleLiveEvent(data);
      } catch (error) {
        console.error('Error procesando mensaje WebSocket:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket desconectado');
      setConnectionStatus('disconnected');
      setWsConnection(null);
      
      // Reconectar después de 3 segundos
      setTimeout(() => {
        if (connectionStatus !== 'connected') {
          connectWebSocket();
        }
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('Error WebSocket:', error);
      setConnectionStatus('error');
    };
  };

  const handleLiveEvent = (event) => {
    console.log('Evento recibido:', event);
    
    // Agregar evento a la lista de eventos en vivo
    setLiveEvents(prev => [...prev, {
      ...event,
      id: Date.now(),
      timestamp: new Date().toISOString()
    }]);
    
    // Manejar diferentes tipos de eventos
    switch (event.event_type) {
      case 'project_created':
        setProjects(prev => [...prev, event.data]);
        break;
        
      case 'project_state':
        setProjects(prev => {
          const existing = prev.find(p => p.id === event.project_id);
          if (existing) {
            return prev.map(p => p.id === event.project_id ? event.data : p);
          }
          return [...prev, event.data];
        });
        break;
        
      case 'progress_update':
        setProjects(prev => prev.map(p => 
          p.id === event.project_id 
            ? { ...p, progress: event.data.progress, current_step: event.data.step }
            : p
        ));
        break;
        
      case 'log_added':
        setProjects(prev => prev.map(p => 
          p.id === event.project_id 
            ? { ...p, logs: [...(p.logs || []), event.data.log] }
            : p
        ));
        break;
        
      case 'error_added':
        setProjects(prev => prev.map(p => 
          p.id === event.project_id 
            ? { ...p, errors: [...(p.errors || []), event.data.error] }
            : p
        ));
        break;
        
      case 'project_completed':
        setProjects(prev => prev.map(p => 
          p.id === event.project_id 
            ? { ...p, status: 'completed', progress: 100 }
            : p
        ));
        break;
        
      case 'file_created':
      case 'file_modified':
        setProjects(prev => prev.map(p => 
          p.id === event.project_id 
            ? { 
                ...p, 
                [event.event_type === 'file_created' ? 'created_files' : 'modified_files']: [
                  ...(p[event.event_type === 'file_created' ? 'created_files' : 'modified_files'] || []),
                  event.data.file_path
                ]
              }
            : p
        ));
        break;
    }
  };

  const loadProjects = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error cargando proyectos:', error);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    
    setIsCreatingProject(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/projects/create`, {
        name: newProjectName,
        project_type: newProjectType
      });
      
      console.log('Proyecto creado:', response.data);
      setNewProjectName('');
      setShowCreateForm(false);
      
      // El proyecto se agregará automáticamente via WebSocket
    } catch (error) {
      console.error('Error creando proyecto:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'building': return 'text-blue-400';
      case 'initializing': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getEventTypeIcon = (eventType) => {
    switch (eventType) {
      case 'project_created': return '🚀';
      case 'progress_update': return '⚡';
      case 'log_added': return '📝';
      case 'error_added': return '❌';
      case 'project_completed': return '✅';
      case 'file_created': return '📄';
      case 'file_modified': return '✏️';
      default: return '📡';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="live-development-container min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">🚀 Live Development System</h1>
            <div className={`flex items-center space-x-2 ${
              connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span className="text-sm">
                {connectionStatus === 'connected' ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <span>➕</span>
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </header>

      <div className="flex h-screen">
        {/* Sidebar de Proyectos */}
        <div className="w-1/3 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Proyectos Activos</h2>
          
          {projects.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No hay proyectos activos</p>
              <p className="text-sm mt-2">Crea tu primer proyecto para empezar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <div 
                  key={project.id}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    currentProject?.id === project.id 
                      ? 'bg-blue-600' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setCurrentProject(project)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{project.name}</h3>
                    <span className={`text-sm ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                  
                  <p className="text-sm text-gray-300">{project.current_step}</p>
                  
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                    <span>📄 {project.created_files?.length || 0}</span>
                    <span>✏️ {project.modified_files?.length || 0}</span>
                    <span>❌ {project.errors?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Área principal */}
        <div className="flex-1 flex flex-col">
          {/* Detalles del proyecto */}
          {currentProject ? (
            <div className="flex-1 p-4">
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h2 className="text-xl font-semibold mb-2">{currentProject.name}</h2>
                <div className="flex items-center space-x-4 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(currentProject.status)}`}>
                    {currentProject.status}
                  </span>
                  <span className="text-gray-400">{currentProject.progress}% completado</span>
                </div>
                
                <div className="w-full bg-gray-600 rounded-full h-3 mb-4">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${currentProject.progress}%` }}
                  ></div>
                </div>
                
                <p className="text-gray-300">{currentProject.current_step}</p>
              </div>

              {/* Logs del proyecto */}
              <div className="bg-gray-800 rounded-lg p-4 flex-1 overflow-hidden">
                <h3 className="text-lg font-semibold mb-2">Logs del Proyecto</h3>
                <div className="h-full overflow-y-auto bg-gray-900 rounded p-3">
                  {currentProject.logs?.map((log, index) => (
                    <div key={index} className="text-sm text-gray-300 mb-1 font-mono">
                      {log}
                    </div>
                  ))}
                  {currentProject.errors?.map((error, index) => (
                    <div key={index} className="text-sm text-red-400 mb-1 font-mono">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <p className="text-xl mb-2">Selecciona un proyecto</p>
                <p>Elige un proyecto de la lista para ver sus detalles</p>
              </div>
            </div>
          )}

          {/* Eventos en vivo */}
          <div className="h-1/3 bg-gray-800 border-t border-gray-700 p-4">
            <h3 className="text-lg font-semibold mb-2">Eventos en Vivo</h3>
            <div className="h-full overflow-y-auto bg-gray-900 rounded p-3">
              {liveEvents.map(event => (
                <div key={event.id} className="text-sm mb-2 flex items-center space-x-2">
                  <span className="text-gray-500">{formatTime(event.timestamp)}</span>
                  <span>{getEventTypeIcon(event.event_type)}</span>
                  <span className="text-gray-300">
                    {event.event_type} - {JSON.stringify(event.data)}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de crear proyecto */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-xl font-semibold mb-4">Crear Nuevo Proyecto</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="Mi Proyecto Awesome"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Proyecto</label>
                <select
                  value={newProjectType}
                  onChange={(e) => setNewProjectType(e.target.value)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="react_app">React App</option>
                  <option value="vue_app">Vue App</option>
                  <option value="angular_app">Angular App</option>
                  <option value="node_api">Node.js API</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={createProject}
                disabled={isCreatingProject || !newProjectName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {isCreatingProject ? 'Creando...' : 'Crear Proyecto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveDevelopmentSystem;