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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
        """Simular creación ultra-rápida de una app React"""
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
            ("✅ Finalizando configuración ultra-rápida...", 95),
            ("🎉 ¡Proyecto completado en tiempo récord!", 100)
        ]
        
        for step, progress in steps:
            await self.manager.update_project_progress(project_id, progress, step)
            await self.manager.add_project_log(project_id, step)
            
            # Velocidad ultra-rápida: 200ms por paso
            await asyncio.sleep(0.2)
            
            # Simular creación de archivos en diferentes etapas
            if progress == 15:
                await self.create_folder_structure(project_id)
            elif progress == 25:
                await self.create_package_json(project_id)
            elif progress == 35:
                await self.create_react_components(project_id)
            elif progress == 45:
                await self.create_styles(project_id)
                
        await self.manager.complete_project(project_id)
        
    async def create_folder_structure(self, project_id: str):
        """Crear estructura de carpetas ultra-rápido"""
        folders = ["src/", "src/components/", "src/pages/", "src/utils/", "public/", "src/assets/"]
        for folder in folders:
            await self.manager.add_project_log(project_id, f"📁 Creando carpeta: {folder}")
            await asyncio.sleep(0.05)
            
    async def create_package_json(self, project_id: str):
        """Crear package.json ultra-rápido"""
        await self.manager.add_project_log(project_id, "📦 ¡Package.json creado exitosamente!")
        await asyncio.sleep(0.1)
        
    async def create_react_components(self, project_id: str):
        """Crear componentes React ultra-rápido"""
        components = [
            "App.jsx", "Header.jsx", "Footer.jsx", "Sidebar.jsx", 
            "MainContent.jsx", "Button.jsx", "Modal.jsx", "Card.jsx"
        ]
        
        for component in components:
            await self.manager.add_project_log(project_id, f"⚛️ Creando componente: {component}")
            await asyncio.sleep(0.05)
            
    async def create_styles(self, project_id: str):
        """Crear estilos ultra-rápido"""
        styles = ["App.css", "index.css", "components.css", "responsive.css"]
        
        for style in styles:
            await self.manager.add_project_log(project_id, f"🎨 Creando estilo: {style}")
            await asyncio.sleep(0.05)

# Inicializar el manager de proyectos
project_manager = ProjectManager(db)
project_simulator = ProjectSimulator(project_manager)

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
