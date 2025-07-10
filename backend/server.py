from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import asyncio
import json
from sse_starlette.sse import EventSourceResponse
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# AI Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# AI API Keys
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# Modelos para el sistema de agentes conversacionales
class AgentType(BaseModel):
    id: str
    name: str
    description: str
    system_message: str
    icon: str
    personality: str
    provider: str  # "openai" or "gemini"
    model: str

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    session_id: str
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    user_id: str = "default"
    messages: List[ChatMessage] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    agent_id: str
    session_id: Optional[str] = None
    message: str

class ChatResponse(BaseModel):
    session_id: str
    message: str
    agent_id: str
    timestamp: datetime

# Sistema de gestión de agentes conversacionales
class AgentManager:
    def __init__(self, db, openai_key: str, gemini_key: str):
        self.db = db
        self.openai_key = openai_key
        self.gemini_key = gemini_key
        self.agent_types = self._initialize_agent_types()
        self.active_chats: Dict[str, LlmChat] = {}
        
    def _initialize_agent_types(self) -> List[AgentType]:
        """Inicializar tipos de agentes predefinidos"""
        return [
            AgentType(
                id="code_assistant",
                name="Asistente de Código",
                description="Especialista en desarrollo de código, mejores prácticas y arquitectura de software",
                system_message="Eres un experto asistente de código con amplia experiencia en desarrollo de software. Ayudas a los desarrolladores a escribir código limpio, eficiente y mantenible. Proporcionas explicaciones claras, mejores prácticas y soluciones elegantes. Siempre incluyes ejemplos de código cuando es relevante.",
                icon="👨‍💻",
                personality="Profesional y didáctico, con enfoque en calidad y buenas prácticas",
                provider="openai",
                model="gpt-4o"
            ),
            AgentType(
                id="debugging_expert",
                name="Experto en Debugging",
                description="Especialista en identificar, analizar y resolver errores en el código",
                system_message="Eres un experto en debugging y resolución de problemas de código. Tu especialidad es identificar la raíz de los problemas, analizar stack traces, y proporcionar soluciones paso a paso. Eres meticuloso, sistemático y siempre proporcionas estrategias claras para resolver bugs.",
                icon="🐛",
                personality="Analítico y meticuloso, con enfoque en resolución sistemática de problemas",
                provider="gemini",
                model="gemini-2.0-flash"
            ),
            AgentType(
                id="code_reviewer",
                name="Revisor de Código",
                description="Experto en revisión de código, calidad y seguridad",
                system_message="Eres un revisor de código experto con ojo crítico para la calidad, seguridad y mantenibilidad. Analizas código en profundidad, identificas problemas potenciales, sugieres mejoras y garantizas que se sigan las mejores prácticas. Tus revisiones son constructivas y educativas.",
                icon="🔍",
                personality="Crítico constructivo, detallista y enfocado en la calidad",
                provider="openai",
                model="gpt-4o"
            ),
            AgentType(
                id="doc_generator",
                name="Generador de Documentación",
                description="Especialista en crear documentación técnica clara y completa",
                system_message="Eres un especialista en documentación técnica. Créas documentación clara, comprensible y completa para código, APIs y proyectos de software. Tu documentación es siempre bien estructurada, incluye ejemplos prácticos y está dirigida tanto a desarrolladores como a usuarios finales.",
                icon="📖",
                personality="Claro y pedagógico, con enfoque en la comprensión del usuario",
                provider="gemini",
                model="gemini-2.0-flash"
            ),
            AgentType(
                id="optimization_expert",
                name="Experto en Optimización",
                description="Especialista en optimización de rendimiento y eficiencia",
                system_message="Eres un experto en optimización de rendimiento y eficiencia de código. Analizas código para identificar cuellos de botella, propones mejoras de rendimiento y sugiere optimizaciones que mejoren la eficiencia sin comprometer la legibilidad. Tienes conocimiento profundo de algoritmos y estructuras de datos.",
                icon="⚡",
                personality="Técnico y orientado a resultados, con enfoque en rendimiento",
                provider="openai",
                model="gpt-4o"
            )
        ]
    
    async def get_agent_types(self) -> List[AgentType]:
        """Obtener todos los tipos de agentes disponibles"""
        return self.agent_types
    
    async def get_agent_by_id(self, agent_id: str) -> Optional[AgentType]:
        """Obtener un agente por ID"""
        return next((agent for agent in self.agent_types if agent.id == agent_id), None)
    
    async def create_chat_session(self, agent_id: str, user_id: str = "default") -> ChatSession:
        """Crear una nueva sesión de chat"""
        agent = await self.get_agent_by_id(agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        session = ChatSession(
            agent_id=agent_id,
            user_id=user_id
        )
        
        # Guardar en base de datos
        await self.db.chat_sessions.insert_one(session.dict())
        return session
    
    async def get_chat_session(self, session_id: str) -> Optional[ChatSession]:
        """Obtener una sesión de chat"""
        session_data = await self.db.chat_sessions.find_one({"id": session_id})
        if session_data:
            return ChatSession(**session_data)
        return None
    
    async def get_user_sessions(self, user_id: str = "default") -> List[ChatSession]:
        """Obtener todas las sesiones de un usuario"""
        sessions = await self.db.chat_sessions.find({"user_id": user_id}).to_list(100)
        return [ChatSession(**session) for session in sessions]
    
    async def send_message(self, chat_request: ChatRequest) -> ChatResponse:
        """Enviar mensaje y obtener respuesta del agente"""
        # Obtener o crear sesión
        session = None
        if chat_request.session_id:
            session = await self.get_chat_session(chat_request.session_id)
        
        if not session:
            session = await self.create_chat_session(chat_request.agent_id)
        
        # Obtener agente
        agent = await self.get_agent_by_id(chat_request.agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Crear mensaje del usuario
        user_message = ChatMessage(
            agent_id=chat_request.agent_id,
            session_id=session.id,
            role="user",
            content=chat_request.message
        )
        
        # Crear o obtener instancia de LlmChat
        chat_key = f"{session.id}_{agent.id}"
        if chat_key not in self.active_chats:
            api_key = self.openai_key if agent.provider == "openai" else self.gemini_key
            self.active_chats[chat_key] = LlmChat(
                api_key=api_key,
                session_id=session.id,
                system_message=agent.system_message
            ).with_model(agent.provider, agent.model)
        
        # Enviar mensaje a la IA
        try:
            user_msg = UserMessage(text=chat_request.message)
            ai_response = await self.active_chats[chat_key].send_message(user_msg)
            
            # Crear mensaje de respuesta
            assistant_message = ChatMessage(
                agent_id=chat_request.agent_id,
                session_id=session.id,
                role="assistant",
                content=ai_response
            )
            
            # Guardar ambos mensajes
            await self.db.chat_messages.insert_one(user_message.dict())
            await self.db.chat_messages.insert_one(assistant_message.dict())
            
            # Actualizar sesión
            session.updated_at = datetime.utcnow()
            await self.db.chat_sessions.update_one(
                {"id": session.id},
                {"$set": {"updated_at": session.updated_at}}
            )
            
            return ChatResponse(
                session_id=session.id,
                message=ai_response,
                agent_id=chat_request.agent_id,
                timestamp=assistant_message.timestamp
            )
            
        except Exception as e:
            logging.error(f"Error sending message to AI: {e}")
            raise HTTPException(status_code=500, detail=f"Error communicating with AI: {str(e)}")
    
    async def get_session_messages(self, session_id: str) -> List[ChatMessage]:
        """Obtener mensajes de una sesión"""
        messages = await self.db.chat_messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).to_list(1000)
        return [ChatMessage(**msg) for msg in messages]
    
    async def delete_session(self, session_id: str):
        """Eliminar sesión y sus mensajes"""
        await self.db.chat_sessions.delete_one({"id": session_id})
        await self.db.chat_messages.delete_many({"session_id": session_id})
        
        # Limpiar chat activo
        for key in list(self.active_chats.keys()):
            if key.startswith(session_id):
                del self.active_chats[key]

# Modelos para el sistema de desarrollo en vivo
class ProjectState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    status: str = "initializing"  # initializing, building, running, error, completed
    progress: float = 0.0
    current_step: str = ""
    created_files: List[str] = []
    modified_files: List[str] = []
    errors: List[str] = []
    logs: List[str] = []
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class LiveEvent(BaseModel):
    event_type: str  # file_created, file_modified, step_completed, error, log, progress
    project_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = {}

class ProjectManager:
    def __init__(self, db):
        self.db = db
        self.active_projects: Dict[str, ProjectState] = {}
        self.websocket_connections: List[WebSocket] = []
        self.file_observer = None
        
    async def create_project(self, name: str, project_type: str = "web_app") -> ProjectState:
        """Crear un nuevo proyecto"""
        project = ProjectState(
            name=name,
            status="initializing",
            current_step="Iniciando proyecto ultra-rápido..."
        )
        
        self.active_projects[project.id] = project
        
        # Guardar en base de datos
        await self.db.projects.insert_one(project.dict())
        
        # Notificar a los clientes
        await self.broadcast_event(LiveEvent(
            event_type="project_created",
            project_id=project.id,
            data=project.dict()
        ))
        
        return project
        
    async def update_project_progress(self, project_id: str, progress: float, step: str):
        """Actualizar progreso del proyecto"""
        if project_id in self.active_projects:
            project = self.active_projects[project_id]
            project.progress = progress
            project.current_step = step
            project.timestamp = datetime.utcnow()
            
            # Actualizar en base de datos
            await self.db.projects.update_one(
                {"id": project_id},
                {"$set": {"progress": progress, "current_step": step, "timestamp": project.timestamp}}
            )
            
            # Notificar a los clientes
            await self.broadcast_event(LiveEvent(
                event_type="progress_update",
                project_id=project_id,
                data={"progress": progress, "step": step}
            ))
            
    async def add_project_log(self, project_id: str, log_message: str):
        """Agregar log al proyecto"""
        if project_id in self.active_projects:
            project = self.active_projects[project_id]
            log_entry = f"[{datetime.utcnow().strftime('%H:%M:%S')}] {log_message}"
            project.logs.append(log_entry)
            
            # Mantener solo los últimos 100 logs
            if len(project.logs) > 100:
                project.logs = project.logs[-100:]
                
            # Actualizar en base de datos
            await self.db.projects.update_one(
                {"id": project_id},
                {"$set": {"logs": project.logs}}
            )
            
            # Notificar a los clientes
            await self.broadcast_event(LiveEvent(
                event_type="log_added",
                project_id=project_id,
                data={"log": log_entry}
            ))
            
    async def complete_project(self, project_id: str):
        """Completar proyecto"""
        if project_id in self.active_projects:
            project = self.active_projects[project_id]
            project.status = "completed"
            project.progress = 100.0
            project.current_step = "🎉 Proyecto completado ultra-rápido!"
            
            # Actualizar en base de datos
            await self.db.projects.update_one(
                {"id": project_id},
                {"$set": {"status": "completed", "progress": 100.0, "current_step": "🎉 Proyecto completado ultra-rápido!"}}
            )
            
            # Notificar a los clientes
            await self.broadcast_event(LiveEvent(
                event_type="project_completed",
                project_id=project_id,
                data=project.dict()
            ))
            
    async def add_websocket(self, websocket: WebSocket):
        """Agregar conexión WebSocket"""
        self.websocket_connections.append(websocket)
        
        # Enviar estado actual de todos los proyectos
        for project in self.active_projects.values():
            await websocket.send_text(json.dumps({
                "event_type": "project_state",
                "project_id": project.id,
                "data": project.dict()
            }, default=str))
            
    async def remove_websocket(self, websocket: WebSocket):
        """Remover conexión WebSocket"""
        if websocket in self.websocket_connections:
            self.websocket_connections.remove(websocket)
            
    async def broadcast_event(self, event: LiveEvent):
        """Enviar evento a todos los clientes conectados"""
        if not self.websocket_connections:
            return
            
        message = json.dumps(event.dict(), default=str)
        disconnected_clients = []
        
        for websocket in self.websocket_connections:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logging.error(f"Error enviando mensaje a WebSocket: {e}")
                disconnected_clients.append(websocket)
                
        # Remover clientes desconectados
        for client in disconnected_clients:
            await self.remove_websocket(client)
            
    async def get_project_state(self, project_id: str) -> Optional[ProjectState]:
        """Obtener estado del proyecto"""
        if project_id in self.active_projects:
            return self.active_projects[project_id]
        return None
        
    async def get_all_projects(self) -> List[ProjectState]:
        """Obtener todos los proyectos activos"""
        return list(self.active_projects.values())

# Simulador de desarrollo de proyectos ultra-rápido
class ProjectSimulator:
    def __init__(self, manager: ProjectManager):
        self.manager = manager
        
    async def simulate_react_app_creation(self, project_id: str):
        """Crear una app React REAL con archivos físicos ultra-rápido"""
        
        # Crear directorio del proyecto
        project_dir = f"/app/generated_projects/{project_id}"
        os.makedirs(project_dir, exist_ok=True)
        os.makedirs(f"{project_dir}/src", exist_ok=True)
        os.makedirs(f"{project_dir}/src/components", exist_ok=True)
        os.makedirs(f"{project_dir}/public", exist_ok=True)
        
        steps = [
            ("🚀 Inicializando proyecto ultra-rápido...", 5),
            ("📁 Creando estructura de carpetas...", 15),
            ("📦 Generando package.json ultra-rápido...", 25),
            ("⚛️ Creando componentes React...", 35),
            ("🎨 Configurando estilos y CSS...", 45),
            ("🔧 Configurando herramientas de build...", 55),
            ("📱 Creando componentes responsivos...", 65),
            ("🌐 Configurando rutas y navegación...", 75),
            ("⚡ Optimizando rendimiento...", 85),
            ("🌍 Configurando servidor en vivo...", 90),
            ("✅ Finalizando configuración ultra-rápida...", 95),
            ("🎉 ¡Proyecto completado y disponible en vivo!", 100)
        ]
        
        for step, progress in steps:
            await self.manager.update_project_progress(project_id, progress, step)
            await self.manager.add_project_log(project_id, step)
            
            # Velocidad ultra-rápida: 200ms por paso
            await asyncio.sleep(0.2)
            
            # Crear archivos REALES en diferentes etapas
            if progress == 15:
                await self.create_real_folder_structure(project_id, project_dir)
            elif progress == 25:
                await self.create_real_package_json(project_id, project_dir)
            elif progress == 35:
                await self.create_real_react_components(project_id, project_dir)
            elif progress == 45:
                await self.create_real_styles(project_id, project_dir)
            elif progress == 55:
                await self.create_real_build_config(project_id, project_dir)
            elif progress == 75:
                await self.create_real_routing(project_id, project_dir)
            elif progress == 90:
                await self.setup_live_server(project_id, project_dir)
                
        await self.manager.complete_project(project_id)
        
    async def create_real_folder_structure(self, project_id: str, project_dir: str):
        """Crear estructura de carpetas REAL"""
        folders = [
            "src/components", "src/pages", "src/utils", "src/assets", 
            "src/styles", "public/assets", "public/images"
        ]
        for folder in folders:
            os.makedirs(f"{project_dir}/{folder}", exist_ok=True)
            await self.manager.add_project_log(project_id, f"📁 Carpeta creada: {folder}")
            await asyncio.sleep(0.05)
            
    async def create_real_package_json(self, project_id: str, project_dir: str):
        """Crear package.json REAL"""
        package_json = {
            "name": f"ultra-fast-project-{project_id[:8]}",
            "version": "1.0.0",
            "private": True,
            "dependencies": {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "react-router-dom": "^6.8.0",
                "axios": "^1.3.0"
            },
            "scripts": {
                "start": "react-scripts start",
                "build": "react-scripts build",
                "test": "react-scripts test",
                "eject": "react-scripts eject"
            },
            "browserslist": {
                "production": [">0.2%", "not dead", "not op_mini all"],
                "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
            }
        }
        
        with open(f"{project_dir}/package.json", "w") as f:
            json.dump(package_json, f, indent=2)
            
        await self.manager.add_project_log(project_id, "📦 ¡Package.json creado exitosamente!")
        await asyncio.sleep(0.1)
        
    async def create_real_react_components(self, project_id: str, project_dir: str):
        """Crear componentes React REALES"""
        
        # App.js principal
        app_js = '''import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;'''

        # Header component
        header_js = '''import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <h1>🚀 Ultra-Fast Project</h1>
        </div>
        <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
        </nav>
        <button 
          className="menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          ☰
        </button>
      </div>
    </header>
  );
};

export default Header;'''

        # Footer component
        footer_js = '''import React from 'react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <p>© 2025 Ultra-Fast Project. Creado en tiempo récord ⚡</p>
        <div className="social-links">
          <a href="#" className="social-link">🐦 Twitter</a>
          <a href="#" className="social-link">📘 Facebook</a>
          <a href="#" className="social-link">💼 LinkedIn</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;'''

        # Home page
        home_js = '''import React, { useState, useEffect } from 'react';

const Home = () => {
  const [counter, setCounter] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const interval = setInterval(() => {
      setCounter(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`page home-page ${isLoaded ? 'loaded' : ''}`}>
      <section className="hero">
        <div className="container">
          <h1 className="hero-title">🚀 ¡Proyecto Ultra-Rápido!</h1>
          <p className="hero-subtitle">
            Creado en tiempo récord con desarrollo en vivo
          </p>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-number">{counter}</span>
              <span className="stat-label">Segundos en vivo</span>
            </div>
            <div className="stat">
              <span className="stat-number">⚡</span>
              <span className="stat-label">Ultra-Fast</span>
            </div>
            <div className="stat">
              <span className="stat-number">100%</span>
              <span className="stat-label">Funcional</span>
            </div>
          </div>
          <button className="cta-button">
            🌟 ¡Increíble!
          </button>
        </div>
      </section>
    </div>
  );
};

export default Home;'''

        # About page
        about_js = '''import React from 'react';

const About = () => {
  return (
    <div className="page about-page">
      <div className="container">
        <h1>📖 Sobre Este Proyecto</h1>
        <div className="about-content">
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Ultra-Rápido</h3>
              <p>Creado en menos de 3 segundos</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚛️</div>
              <h3>React Moderno</h3>
              <p>Usando las últimas tecnologías</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Diseño Responsivo</h3>
              <p>Se ve genial en todos los dispositivos</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Tiempo Real</h3>
              <p>Desarrollo visible en vivo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;'''

        # Contact page
        contact_js = '''import React, { useState } from 'react';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('¡Mensaje enviado! (Simulado) ⚡');
  };

  return (
    <div className="page contact-page">
      <div className="container">
        <h1>📧 Contacto</h1>
        <div className="contact-content">
          <form onSubmit={handleSubmit} className="contact-form">
            <div className="form-group">
              <label>Nombre:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Mensaje:</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                required
              ></textarea>
            </div>
            <button type="submit" className="submit-button">
              🚀 Enviar Ultra-Rápido
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;'''

        # index.js
        index_js = '''import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);'''

        # Escribir archivos
        files = {
            'src/App.js': app_js,
            'src/components/Header.js': header_js,
            'src/components/Footer.js': footer_js,
            'src/pages/Home.js': home_js,
            'src/pages/About.js': about_js,
            'src/pages/Contact.js': contact_js,
            'src/index.js': index_js
        }
        
        for file_path, content in files.items():
            with open(f"{project_dir}/{file_path}", "w") as f:
                f.write(content)
            await self.manager.add_project_log(project_id, f"⚛️ Componente creado: {file_path}")
            await asyncio.sleep(0.05)
            
    async def create_real_styles(self, project_id: str, project_dir: str):
        """Crear estilos CSS REALES"""
        
        app_css = '''/* Reset y estilos base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  line-height: 1.6;
  color: #333;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 20px;
}

.logo h1 {
  color: #667eea;
  font-size: 1.5rem;
}

.nav {
  display: flex;
  gap: 2rem;
}

.nav-link {
  color: #333;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.nav-link:hover {
  color: #667eea;
}

.menu-toggle {
  display: none;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}

/* Main content */
.main-content {
  min-height: calc(100vh - 140px);
}

.page {
  padding: 2rem 0;
  opacity: 0;
  transform: translateY(20px);
  animation: fadeInUp 0.6s ease forwards;
}

.page.loaded {
  opacity: 1;
  transform: translateY(0);
}

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hero section */
.hero {
  text-align: center;
  padding: 4rem 0;
  color: white;
}

.hero-title {
  font-size: 3rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.hero-subtitle {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin: 2rem 0;
}

.stat {
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 10px;
  backdrop-filter: blur(5px);
}

.stat-number {
  display: block;
  font-size: 2rem;
  font-weight: bold;
}

.stat-label {
  font-size: 0.9rem;
  opacity: 0.8;
}

.cta-button {
  background: linear-gradient(45deg, #ff6b6b, #feca57);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 50px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.3s;
}

.cta-button:hover {
  transform: translateY(-3px);
}

/* Feature grid */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.feature-card {
  background: rgba(255, 255, 255, 0.9);
  padding: 2rem;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

/* Contact form */
.contact-form {
  background: rgba(255, 255, 255, 0.9);
  padding: 2rem;
  border-radius: 15px;
  max-width: 600px;
  margin: 2rem auto;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.8rem;
  border: 2px solid #e1e1e1;
  border-radius: 8px;
  transition: border-color 0.3s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.submit-button {
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.3s;
}

.submit-button:hover {
  transform: translateY(-2px);
}

/* Footer */
.footer {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  text-align: center;
  padding: 2rem 0;
  margin-top: auto;
}

.social-links {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.social-link {
  color: white;
  text-decoration: none;
  transition: opacity 0.3s;
}

.social-link:hover {
  opacity: 0.7;
}

/* Responsive */
@media (max-width: 768px) {
  .menu-toggle {
    display: block;
  }
  
  .nav {
    display: none;
  }
  
  .nav-open {
    display: flex;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    padding: 1rem;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  .hero-title {
    font-size: 2rem;
  }
  
  .hero-stats {
    flex-direction: column;
    align-items: center;
  }
}'''

        with open(f"{project_dir}/src/styles/App.css", "w") as f:
            f.write(app_css)
            
        await self.manager.add_project_log(project_id, "🎨 ¡Estilos CSS ultra-modernos creados!")
        await asyncio.sleep(0.1)
        
    async def create_real_build_config(self, project_id: str, project_dir: str):
        """Crear configuración de build REAL"""
        
        # public/index.html
        index_html = '''<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8" />
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚀</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#667eea" />
    <meta name="description" content="Proyecto Ultra-Rápido creado en tiempo récord" />
    <title>🚀 Ultra-Fast Project</title>
</head>
<body>
    <noscript>Necesitas habilitar JavaScript para ver esta aplicación.</noscript>
    <div id="root"></div>
</body>
</html>'''

        with open(f"{project_dir}/public/index.html", "w") as f:
            f.write(index_html)
            
        await self.manager.add_project_log(project_id, "🔧 Configuración de build completada")
        await asyncio.sleep(0.05)
        
    async def create_real_routing(self, project_id: str, project_dir: str):
        """Crear sistema de rutas REAL"""
        
        # Crear carpeta pages si no existe
        os.makedirs(f"{project_dir}/src/pages", exist_ok=True)
        
        await self.manager.add_project_log(project_id, "🌐 Sistema de rutas React Router configurado")
        await asyncio.sleep(0.05)
        
    async def setup_live_server(self, project_id: str, project_dir: str):
        """Configurar servidor en vivo para el proyecto"""
        
        # Crear un simple servidor estático usando Python
        server_py = f'''#!/usr/bin/env python3
import http.server
import socketserver
import os
import threading
from pathlib import Path

PORT = 300{project_id[-2:]}  # Puerto único basado en project_id
DIRECTORY = "{project_dir}"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{{PORT}}")
        httpd.serve_forever()

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    start_server()
'''

        with open(f"{project_dir}/server.py", "w") as f:
            f.write(server_py)
            
        # Hacer el archivo ejecutable
        os.chmod(f"{project_dir}/server.py", 0o755)
        
        # Crear un archivo simple HTML que funcione sin build
        simple_html = f'''<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🚀 Ultra-Fast Project - Vista Previa</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }}
        .container {{
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 3rem;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: fadeIn 1s ease-out;
        }}
        @keyframes fadeIn {{
            from {{ opacity: 0; transform: translateY(20px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}
        h1 {{ font-size: 3rem; margin-bottom: 1rem; }}
        p {{ font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }}
        .stats {{
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin: 2rem 0;
        }}
        .stat {{
            background: rgba(255, 255, 255, 0.1);
            padding: 1rem;
            border-radius: 10px;
        }}
        .stat-number {{ display: block; font-size: 2rem; font-weight: bold; }}
        .stat-label {{ font-size: 0.9rem; opacity: 0.8; }}
        .button {{
            background: linear-gradient(45deg, #ff6b6b, #feca57);
            color: white;
            border: none;
            padding: 1rem 2rem;
            border-radius: 50px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.3s;
            margin: 0.5rem;
        }}
        .button:hover {{ transform: translateY(-3px); }}
        .project-info {{
            margin-top: 2rem;
            font-size: 0.9rem;
            opacity: 0.8;
        }}
        #counter {{ color: #feca57; font-weight: bold; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ¡Proyecto Ultra-Rápido!</h1>
        <p>Creado en tiempo récord con desarrollo en vivo</p>
        
        <div class="stats">
            <div class="stat">
                <span class="stat-number" id="counter">0</span>
                <span class="stat-label">Segundos en vivo</span>
            </div>
            <div class="stat">
                <span class="stat-number">⚡</span>
                <span class="stat-label">Ultra-Fast</span>
            </div>
            <div class="stat">
                <span class="stat-number">100%</span>
                <span class="stat-label">Funcional</span>
            </div>
        </div>
        
        <button class="button" onclick="showAlert()">🌟 ¡Increíble!</button>
        <button class="button" onclick="changeColor()">🎨 Cambiar Color</button>
        
        <div class="project-info">
            <p>ID del Proyecto: {project_id}</p>
            <p>Creado el: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
            <p>🔗 <strong>Proyecto funcionando en vivo</strong></p>
        </div>
    </div>

    <script>
        let counter = 0;
        setInterval(() => {{
            counter++;
            document.getElementById('counter').textContent = counter;
        }}, 1000);
        
        function showAlert() {{
            alert('¡Proyecto Ultra-Rápido funcionando perfectamente! ⚡🚀');
        }}
        
        function changeColor() {{
            const colors = [
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            ];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            document.body.style.background = randomColor;
        }}
        
        // Animación de partículas
        function createParticle() {{
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                width: 6px;
                height: 6px;
                background: #feca57;
                border-radius: 50%;
                pointer-events: none;
                z-index: 1000;
                left: ${{Math.random() * 100}}%;
                top: 100%;
                animation: float 3s ease-out forwards;
            `;
            document.body.appendChild(particle);
            
            setTimeout(() => particle.remove(), 3000);
        }}
        
        // Crear partículas cada 2 segundos
        setInterval(createParticle, 2000);
        
        // Añadir CSS para animación de partículas
        const style = document.createElement('style');
        style.textContent = `
            @keyframes float {{
                to {{
                    transform: translateY(-100vh) rotate(360deg);
                    opacity: 0;
                }}
            }}
        `;
        document.head.appendChild(style);
    </script>
</body>
</html>'''

        with open(f"{project_dir}/index.html", "w") as f:
            f.write(simple_html)
            
        await self.manager.add_project_log(project_id, f"🌍 ¡Servidor configurado! Disponible en puerto 300{project_id[-2:]}")
        await asyncio.sleep(0.1)

# Inicializar el manager de proyectos
project_manager = ProjectManager(db)
project_simulator = ProjectSimulator(project_manager)

# Inicializar el manager de agentes
agent_manager = AgentManager(db, OPENAI_API_KEY, GEMINI_API_KEY)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class ProjectCreate(BaseModel):
    name: str
    project_type: str = "react_app"

# Endpoints existentes
@api_router.get("/")
async def root():
    return {"message": "Live Development System Ultra-Fast Ready! ⚡"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Nuevos endpoints para desarrollo ultra-rápido
@api_router.post("/projects/create")
async def create_project(project_data: ProjectCreate):
    """Crear un nuevo proyecto ultra-rápido"""
    try:
        project = await project_manager.create_project(project_data.name, project_data.project_type)
        
        # Iniciar simulación ultra-rápida en background
        if project_data.project_type == "react_app":
            asyncio.create_task(project_simulator.simulate_react_app_creation(project.id))
        
        return {"project_id": project.id, "status": "created", "message": "¡Proyecto ultra-rápido iniciado! ⚡"}
    except Exception as e:
        logging.error(f"Error creando proyecto: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating project: {str(e)}")

@api_router.get("/projects")
async def get_projects():
    """Obtener todos los proyectos"""
    projects = await project_manager.get_all_projects()
    return [project.dict() for project in projects]

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Obtener un proyecto específico"""
    project = await project_manager.get_project_state(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.dict()

# WebSocket para actualizaciones ultra-rápidas en tiempo real
@api_router.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await project_manager.add_websocket(websocket)
    
    try:
        while True:
            # Mantener la conexión activa
            data = await websocket.receive_text()
            # Procesar comandos del cliente si es necesario
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await project_manager.remove_websocket(websocket)
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        await project_manager.remove_websocket(websocket)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
