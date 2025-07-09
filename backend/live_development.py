import asyncio
import json
import os
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from pathlib import Path
import uuid
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from motor.motor_asyncio import AsyncIOMotorClient

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        self.setup_file_watcher()
        
    def setup_file_watcher(self):
        """Configurar el observador de archivos"""
        class ProjectFileHandler(FileSystemEventHandler):
            def __init__(self, manager):
                self.manager = manager
                
            def on_created(self, event):
                if not event.is_directory:
                    self.manager.handle_file_event('file_created', event.src_path)
                    
            def on_modified(self, event):
                if not event.is_directory:
                    self.manager.handle_file_event('file_modified', event.src_path)
                    
        self.file_handler = ProjectFileHandler(self)
        self.file_observer = Observer()
        self.file_observer.schedule(self.file_handler, '/app', recursive=True)
        self.file_observer.start()
        
    def handle_file_event(self, event_type: str, file_path: str):
        """Manejar eventos de archivos"""
        # Filtrar solo archivos relevantes del proyecto
        if any(ignore in file_path for ignore in ['.git', '__pycache__', 'node_modules', '.env']):
            return
            
        for project_id, project in self.active_projects.items():
            if event_type == 'file_created':
                if file_path not in project.created_files:
                    project.created_files.append(file_path)
            elif event_type == 'file_modified':
                if file_path not in project.modified_files:
                    project.modified_files.append(file_path)
                    
            # Enviar evento a los clientes
            asyncio.create_task(self.broadcast_event(LiveEvent(
                event_type=event_type,
                project_id=project_id,
                data={'file_path': file_path}
            )))
            
    async def create_project(self, name: str, project_type: str = "web_app") -> ProjectState:
        """Crear un nuevo proyecto"""
        project = ProjectState(
            name=name,
            status="initializing",
            current_step="Iniciando proyecto..."
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
            
    async def add_project_error(self, project_id: str, error_message: str):
        """Agregar error al proyecto"""
        if project_id in self.active_projects:
            project = self.active_projects[project_id]
            error_entry = f"[{datetime.utcnow().strftime('%H:%M:%S')}] ERROR: {error_message}"
            project.errors.append(error_entry)
            project.status = "error"
            
            # Actualizar en base de datos
            await self.db.projects.update_one(
                {"id": project_id},
                {"$set": {"errors": project.errors, "status": "error"}}
            )
            
            # Notificar a los clientes
            await self.broadcast_event(LiveEvent(
                event_type="error_added",
                project_id=project_id,
                data={"error": error_entry}
            ))
            
    async def complete_project(self, project_id: str):
        """Completar proyecto"""
        if project_id in self.active_projects:
            project = self.active_projects[project_id]
            project.status = "completed"
            project.progress = 100.0
            project.current_step = "Proyecto completado"
            
            # Actualizar en base de datos
            await self.db.projects.update_one(
                {"id": project_id},
                {"$set": {"status": "completed", "progress": 100.0, "current_step": "Proyecto completado"}}
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
                logger.error(f"Error enviando mensaje a WebSocket: {e}")
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
        
    def cleanup(self):
        """Limpiar recursos"""
        if self.file_observer:
            self.file_observer.stop()
            self.file_observer.join()

# Simulador de desarrollo de proyectos
class ProjectSimulator:
    def __init__(self, manager: ProjectManager):
        self.manager = manager
        
    async def simulate_react_app_creation(self, project_id: str):
        """Simular creación de una app React con velocidad ultra-rápida"""
        steps = [
            ("🚀 Inicializando proyecto...", 5),
            ("📁 Creando estructura de carpetas...", 15),
            ("📦 Generando package.json...", 25),
            ("⚛️ Creando componentes React...", 35),
            ("🎨 Configurando estilos y CSS...", 45),
            ("🔧 Configurando herramientas de build...", 55),
            ("📱 Creando componentes responsivos...", 65),
            ("🌐 Configurando rutas y navegación...", 75),
            ("⚡ Optimizando rendimiento...", 85),
            ("✅ Finalizando configuración...", 95),
            ("🎉 Proyecto completado!", 100)
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
            elif progress == 55:
                await self.create_build_config(project_id)
            elif progress == 65:
                await self.create_responsive_components(project_id)
            elif progress == 75:
                await self.create_routing(project_id)
            elif progress == 85:
                await self.optimize_performance(project_id)
                
        await self.manager.complete_project(project_id)
        
    async def create_folder_structure(self, project_id: str):
        """Crear estructura de carpetas"""
        folders = ["src/", "src/components/", "src/pages/", "src/utils/", "public/", "src/assets/"]
        for folder in folders:
            await self.manager.add_project_log(project_id, f"📁 Creando carpeta: {folder}")
            await asyncio.sleep(0.05)
            
    async def create_package_json(self, project_id: str):
        """Crear package.json ultra-rápido"""
        content = {
            "name": "live-dev-project",
            "version": "1.0.0",
            "dependencies": {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "react-router-dom": "^6.8.0",
                "axios": "^1.3.0"
            }
        }
        
        await self.manager.add_project_log(project_id, "📦 Creando package.json")
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
        styles = [
            "App.css", "index.css", "components.css", "responsive.css", 
            "animations.css", "variables.css"
        ]
        
        for style in styles:
            await self.manager.add_project_log(project_id, f"🎨 Creando estilo: {style}")
            await asyncio.sleep(0.05)
            
    async def create_build_config(self, project_id: str):
        """Crear configuración de build"""
        configs = ["webpack.config.js", "babel.config.js", ".env", "tsconfig.json"]
        
        for config in configs:
            await self.manager.add_project_log(project_id, f"🔧 Configurando: {config}")
            await asyncio.sleep(0.05)
            
    async def create_responsive_components(self, project_id: str):
        """Crear componentes responsivos"""
        responsive_components = [
            "MobileNav.jsx", "TabletLayout.jsx", "DesktopHeader.jsx", "ResponsiveGrid.jsx"
        ]
        
        for component in responsive_components:
            await self.manager.add_project_log(project_id, f"📱 Creando componente responsivo: {component}")
            await asyncio.sleep(0.05)
            
    async def create_routing(self, project_id: str):
        """Crear sistema de rutas"""
        routes = ["Router.jsx", "routes/index.js", "pages/Home.jsx", "pages/About.jsx"]
        
        for route in routes:
            await self.manager.add_project_log(project_id, f"🌐 Configurando ruta: {route}")
            await asyncio.sleep(0.05)
            
    async def optimize_performance(self, project_id: str):
        """Optimizar rendimiento"""
        optimizations = [
            "Lazy loading components", "Code splitting", "Bundle optimization", 
            "Cache configuration", "Performance monitoring"
        ]
        
        for optimization in optimizations:
            await self.manager.add_project_log(project_id, f"⚡ Optimizando: {optimization}")
            await asyncio.sleep(0.05)