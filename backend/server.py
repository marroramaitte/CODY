from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
import asyncio
import json
from sse_starlette.sse import EventSourceResponse

# Importar el sistema de desarrollo en vivo
from live_development import ProjectManager, ProjectSimulator, LiveEvent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    return {"message": "Live Development System Ready"}

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

# Nuevos endpoints para desarrollo en vivo
@api_router.post("/projects/create")
async def create_project(project_data: ProjectCreate):
    """Crear un nuevo proyecto"""
    project = await project_manager.create_project(project_data.name, project_data.project_type)
    
    # Iniciar simulación de desarrollo en background
    if project_data.project_type == "react_app":
        asyncio.create_task(project_simulator.simulate_react_app_creation(project.id))
    
    return {"project_id": project.id, "status": "created"}

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

@api_router.post("/projects/{project_id}/logs")
async def add_project_log(project_id: str, log_data: dict):
    """Agregar log a un proyecto"""
    await project_manager.add_project_log(project_id, log_data.get("message", ""))
    return {"status": "log_added"}

@api_router.post("/projects/{project_id}/errors")
async def add_project_error(project_id: str, error_data: dict):
    """Agregar error a un proyecto"""
    await project_manager.add_project_error(project_id, error_data.get("message", ""))
    return {"status": "error_added"}

# WebSocket para actualizaciones en tiempo real
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

# Server-Sent Events para navegadores que no soportan WebSockets
@api_router.get("/stream/events")
async def stream_events():
    """Stream de eventos usando Server-Sent Events"""
    async def event_generator():
        last_event_time = datetime.utcnow()
        while True:
            # Enviar heartbeat cada 30 segundos
            await asyncio.sleep(1)
            
            # Aquí podrías enviar eventos reales desde el project_manager
            # Por ahora enviamos un heartbeat
            current_time = datetime.utcnow()
            if (current_time - last_event_time).seconds >= 30:
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"timestamp": current_time.isoformat()})
                }
                last_event_time = current_time
    
    return EventSourceResponse(event_generator())

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
    project_manager.cleanup()
