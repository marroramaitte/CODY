import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AgentSelector from './AgentSelector';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const EnhancedChatBot = ({ onClose, currentCode }) => {
  const [currentAgent, setCurrentAgent] = useState(null);
  const [agentSelectorVisible, setAgentSelectorVisible] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.id);
    }
  }, [currentSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/chat/sessions`);
      setSessions(response.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadMessages = async (sessionId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/chat/sessions/${sessionId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleAgentSelected = async (agent) => {
    setCurrentAgent(agent);
    
    // Buscar sesión existente para este agente
    const existingSession = sessions.find(s => s.agent_id === agent.id);
    
    if (existingSession) {
      setCurrentSession(existingSession);
    } else {
      // Crear nueva sesión
      try {
        const response = await axios.post(`${BACKEND_URL}/api/chat/sessions?agent_id=${agent.id}`);
        const newSession = response.data;
        setSessions([...sessions, newSession]);
        setCurrentSession(newSession);
        setMessages([]);
      } catch (error) {
        console.error('Error creating session:', error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !currentAgent || !currentSession) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/chat/send`, {
        agent_id: currentAgent.id,
        session_id: currentSession.id,
        message: inputMessage
      });

      const assistantMessage = {
        id: Date.now().toString() + '_ai',
        role: 'assistant',
        content: response.data.message,
        timestamp: response.data.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Actualizar sesión
      await loadSessions();
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now().toString() + '_error',
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getAgentIcon = (agent) => {
    return agent?.icon || '🤖';
  };

  const switchToSession = (session) => {
    setCurrentSession(session);
    // Encontrar el agente correspondiente
    // Esto requiere que carguemos los agentes, por simplicidad usaremos un mapeo básico
    const agentMap = {
      'code_assistant': { id: 'code_assistant', name: 'Asistente de Código', icon: '👨‍💻' },
      'debugging_expert': { id: 'debugging_expert', name: 'Experto en Debugging', icon: '🐛' },
      'code_reviewer': { id: 'code_reviewer', name: 'Revisor de Código', icon: '🔍' },
      'doc_generator': { id: 'doc_generator', name: 'Generador de Documentación', icon: '📖' },
      'optimization_expert': { id: 'optimization_expert', name: 'Experto en Optimización', icon: '⚡' }
    };
    
    setCurrentAgent(agentMap[session.agent_id] || { id: session.agent_id, name: 'Agente', icon: '🤖' });
  };

  const deleteSession = async (sessionId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/chat/sessions/${sessionId}`);
      setSessions(sessions.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setCurrentAgent(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-gray-800 rounded-lg w-[80%] h-[80%] flex flex-col">
        {/* Header */}
        <div className="bg-gray-700 p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-semibold text-white">
              Chat con Agentes IA
            </h2>
            {currentAgent && (
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-lg">{getAgentIcon(currentAgent)}</span>
                <span className="text-sm text-gray-300">{currentAgent.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAgentSelectorVisible(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              Seleccionar Agente
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar con sesiones */}
          <div className="w-1/4 bg-gray-750 border-r border-gray-600 overflow-y-auto">
            <div className="p-3 border-b border-gray-600">
              <h3 className="text-sm font-semibold text-gray-300">Sesiones Activas</h3>
            </div>
            <div className="space-y-1 p-2">
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => switchToSession(session)}
                  className={`p-2 rounded cursor-pointer transition-colors ${
                    currentSession?.id === session.id
                      ? 'bg-blue-600'
                      : 'hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">
                        {session.agent_id === 'code_assistant' && '👨‍💻'}
                        {session.agent_id === 'debugging_expert' && '🐛'}
                        {session.agent_id === 'code_reviewer' && '🔍'}
                        {session.agent_id === 'doc_generator' && '📖'}
                        {session.agent_id === 'optimization_expert' && '⚡'}
                      </span>
                      <span className="text-xs text-gray-300 truncate">
                        {session.agent_id.replace('_', ' ')}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(session.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {!currentAgent ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-4">🤖</div>
                  <p className="text-lg mb-2">¡Bienvenido al Chat con Agentes IA!</p>
                  <p className="text-sm mb-4">Selecciona un agente para comenzar</p>
                  <button
                    onClick={() => setAgentSelectorVisible(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
                  >
                    Seleccionar Agente
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <div className="text-3xl mb-2">{getAgentIcon(currentAgent)}</div>
                      <p>¡Hola! Soy {currentAgent.name}.</p>
                      <p className="text-sm">¿En qué puedo ayudarte hoy?</p>
                    </div>
                  ) : (
                    messages.map(message => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[70%] p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {formatTimestamp(message.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <span className="text-sm text-gray-400 ml-2">
                            {currentAgent.name} está escribiendo...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-gray-600 p-4">
                  <div className="flex space-x-2">
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={`Pregunta a ${currentAgent.name}...`}
                      className="flex-1 bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                      rows="2"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isTyping}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Agent Selector Modal */}
      {agentSelectorVisible && (
        <AgentSelector
          onClose={() => setAgentSelectorVisible(false)}
          onAgentSelected={handleAgentSelected}
          currentAgent={currentAgent}
        />
      )}
    </div>
  );
};

export default EnhancedChatBot;