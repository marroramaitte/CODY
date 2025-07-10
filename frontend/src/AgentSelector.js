import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const AgentSelector = ({ onClose, onAgentSelected, currentAgent }) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/agents`);
      setAgents(response.data);
    } catch (err) {
      setError('Error cargando agentes');
      console.error('Error loading agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentSelect = (agent) => {
    onAgentSelected(agent);
    onClose();
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'openai':
        return '🤖';
      case 'gemini':
        return '💎';
      default:
        return '🔮';
    }
  };

  const getProviderName = (provider) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI';
      case 'gemini':
        return 'Gemini';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-96">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-white">Cargando agentes...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-96">
          <div className="text-red-400 mb-4">
            <span className="mr-2">❌</span>
            {error}
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            🤖 Seleccionar Agente Conversacional
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => handleAgentSelect(agent)}
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                currentAgent?.id === agent.id
                  ? 'border-blue-500 bg-blue-900 bg-opacity-30'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="text-3xl">{agent.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">{agent.name}</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">
                        {getProviderIcon(agent.provider)} {getProviderName(agent.provider)}
                      </span>
                      <span className="text-xs bg-gray-600 px-2 py-1 rounded">
                        {agent.model}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{agent.description}</p>
                  <div className="text-xs text-gray-400 italic">
                    "{agent.personality}"
                  </div>
                </div>
              </div>
              
              {currentAgent?.id === agent.id && (
                <div className="mt-3 flex items-center text-blue-400 text-sm">
                  <span className="mr-1">✓</span>
                  <span>Agente activo</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>💡 Cada agente tiene su propio historial de conversación</p>
          <p>🔄 Puedes cambiar de agente en cualquier momento</p>
        </div>
      </div>
    </div>
  );
};

export default AgentSelector;