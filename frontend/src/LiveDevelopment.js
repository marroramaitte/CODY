import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Componente de rueda de progreso circular
const CircularProgress = ({ progress, size = 120, strokeWidth = 8, color = "#007acc" }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        className="transform -rotate-90 animate-spin-slow"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#2d2d2d"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
      </div>
    </div>
  );
};

// Componente de rueda pequeña para archivos
const MiniProgress = ({ progress, label, icon }) => {
  return (
    <div className="flex items-center space-x-3 p-2 bg-gray-800 rounded-lg">
      <div className="relative">
        <svg className="w-8 h-8 transform -rotate-90">
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke="#4a5568"
            strokeWidth="2"
            fill="transparent"
          />
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke="#00ff88"
            strokeWidth="2"
            fill="transparent"
            strokeDasharray={75.36}
            strokeDashoffset={75.36 - (progress / 100) * 75.36}
            strokeLinecap="round"
            className="transition-all duration-200"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs">{icon}</span>
        </div>
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </div>
  );
};

// Componente de efecto de partículas para celebración
const ParticleEffect = ({ show }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1 + Math.random()}s`
          }}
        />
      ))}
    </div>
  );
};

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
  const [showCelebration, setShowCelebration] = useState(false);
  const [realtimeStats, setRealtimeStats] = useState({
    filesCreated: 0,
    componentsBuilt: 0,
    linesOfCode: 0
  });
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
    
    // Actualizar estadísticas en tiempo real
    if (event.event_type === 'log_added') {
      const log = event.data.log;
      if (log.includes('Creando')) {
        setRealtimeStats(prev => ({
          ...prev,
          filesCreated: prev.filesCreated + 1,
          linesOfCode: prev.linesOfCode + Math.floor(Math.random() * 50) + 10
        }));
      }
      if (log.includes('componente')) {
        setRealtimeStats(prev => ({
          ...prev,
          componentsBuilt: prev.componentsBuilt + 1
        }));
      }
    }
    
    // Manejar diferentes tipos de eventos
    switch (event.event_type) {
      case 'project_created':
        setProjects(prev => [...prev, event.data]);
        setRealtimeStats({ filesCreated: 0, componentsBuilt: 0, linesOfCode: 0 });
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
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
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
      <ParticleEffect show={showCelebration} />
      
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">🚀 Live Development System</h1>
            <div className={`flex items-center space-x-2 ${
              connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}></div>
              <span className="text-sm">
                {connectionStatus === 'connected' ? 'Ultra-Fast Mode' : 'Desconectado'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Estadísticas en tiempo real */}
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <span>📄</span>
                <span>{realtimeStats.filesCreated}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>⚛️</span>
                <span>{realtimeStats.componentsBuilt}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span>📝</span>
                <span>{realtimeStats.linesOfCode.toLocaleString()}</span>
              </div>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 py-2 rounded-lg flex items-center space-x-2 shadow-lg transition-all duration-200"
            >
              <span>⚡</span>
              <span>Proyecto Ultra-Rápido</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-screen">
        {/* Sidebar de Proyectos */}
        <div className="w-1/3 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Proyectos en Desarrollo</h2>
          
          {projects.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <div className="mb-4">
                <CircularProgress progress={0} size={80} />
              </div>
              <p>¡Listo para crear proyectos ultra-rápidos!</p>
              <p className="text-sm mt-2">Velocidad de desarrollo: ⚡ Ultra-Fast</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map(project => (
                <div 
                  key={project.id}
                  className={`p-4 rounded-lg cursor-pointer transition-all duration-300 ${
                    currentProject?.id === project.id 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg' 
                      : 'bg-gray-700 hover:bg-gray-600 hover:shadow-md'
                  }`}
                  onClick={() => setCurrentProject(project)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{project.name}</h3>
                    <span className={`text-sm ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                  
                  {/* Rueda de progreso circular */}
                  <div className="flex items-center space-x-4 mb-3">
                    <CircularProgress 
                      progress={project.progress || 0} 
                      size={60} 
                      strokeWidth={4}
                      color={project.status === 'completed' ? '#00ff88' : '#007acc'}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-300 mb-1">{project.current_step}</p>
                      <div className="flex space-x-2">
                        <MiniProgress 
                          progress={Math.min((project.created_files?.length || 0) * 10, 100)} 
                          label="Archivos" 
                          icon="📄" 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
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
              <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-6 mb-4 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold">{currentProject.name}</h2>
                  <div className="flex items-center space-x-4">
                    <CircularProgress 
                      progress={currentProject.progress || 0} 
                      size={100} 
                      strokeWidth={6}
                      color={currentProject.status === 'completed' ? '#00ff88' : '#007acc'}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 mb-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(currentProject.status)} bg-gray-800`}>
                    {currentProject.status} {currentProject.status === 'building' && '⚡'}
                  </span>
                  <span className="text-gray-400">{currentProject.progress || 0}% completado</span>
                  <span className="text-sm text-yellow-400">Ultra-Fast Mode ⚡</span>
                </div>
                
                <p className="text-gray-300 text-lg">{currentProject.current_step}</p>
              </div>

              {/* Logs del proyecto con mejor visualización */}
              <div className="bg-gray-800 rounded-lg p-4 flex-1 overflow-hidden shadow-lg">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <span className="mr-2">📊</span>
                  Logs en Tiempo Real
                  <span className="ml-2 text-green-400 animate-pulse">●</span>
                </h3>
                <div className="h-full overflow-y-auto bg-black rounded p-3 font-mono text-sm">
                  {currentProject.logs?.map((log, index) => (
                    <div key={index} className="text-green-400 mb-1 animate-fade-in">
                      <span className="text-gray-500">[{formatTime(new Date())}]</span> {log}
                    </div>
                  ))}
                  {currentProject.errors?.map((error, index) => (
                    <div key={index} className="text-red-400 mb-1 animate-fade-in">
                      <span className="text-gray-500">[{formatTime(new Date())}]</span> {error}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="mb-4">
                  <CircularProgress progress={0} size={120} />
                </div>
                <p className="text-xl mb-2">¡Sistema Ultra-Rápido Listo!</p>
                <p>Selecciona un proyecto para ver el desarrollo en vivo</p>
                <p className="text-sm mt-2 text-yellow-400">⚡ Velocidad optimizada para máximo rendimiento</p>
              </div>
            </div>
          )}

          {/* Eventos en vivo */}
          <div className="h-1/4 bg-gray-800 border-t border-gray-700 p-4">
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <span className="mr-2">⚡</span>
              Ultra-Fast Events
              <span className="ml-2 text-green-400 animate-pulse">●</span>
            </h3>
            <div className="h-full overflow-y-auto bg-black rounded p-3 font-mono text-xs">
              {liveEvents.map(event => (
                <div key={event.id} className="mb-1 flex items-center space-x-2 animate-slide-in">
                  <span className="text-gray-500">{formatTime(event.timestamp)}</span>
                  <span>{getEventTypeIcon(event.event_type)}</span>
                  <span className="text-green-400">
                    {event.event_type}
                  </span>
                  <span className="text-gray-300 truncate">
                    {JSON.stringify(event.data).substring(0, 50)}...
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de crear proyecto mejorado */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-xl w-96 shadow-2xl border border-gray-600">
            <h3 className="text-2xl font-semibold mb-6 text-center">🚀 Proyecto Ultra-Rápido</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre del Proyecto</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mi Proyecto Ultra-Rápido"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Proyecto</label>
                <select
                  value={newProjectType}
                  onChange={(e) => setNewProjectType(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="react_app">⚛️ React App (Ultra-Fast)</option>
                  <option value="vue_app">💚 Vue App (Ultra-Fast)</option>
                  <option value="angular_app">🅰️ Angular App (Ultra-Fast)</option>
                  <option value="node_api">🟢 Node.js API (Ultra-Fast)</option>
                </select>
              </div>
              
              <div className="text-center text-sm text-yellow-400">
                ⚡ Creación en ~2 segundos con visualización en tiempo real
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createProject}
                disabled={isCreatingProject || !newProjectName.trim()}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg disabled:opacity-50 transition-all shadow-lg"
              >
                {isCreatingProject ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creando...</span>
                  </div>
                ) : (
                  '⚡ Crear Ultra-Rápido'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveDevelopmentSystem;