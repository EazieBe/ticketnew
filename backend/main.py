import logging
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, WebSocket, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
import secrets
import string
import os
import json
import asyncio
from redis.asyncio import Redis
import jwt
from contextlib import asynccontextmanager

import models, schemas, crud
from database import SessionLocal, engine, get_db
from settings import settings

# Set SECRET_KEY in env before any import that loads auth (auth validates length at import)
os.environ.setdefault("SECRET_KEY", settings.SECRET_KEY)

from utils.main_utils import verify_password, create_access_token, APILatencyTracker, timer_ms

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ticketing")

# Create database tables only when explicitly enabled (e.g. local dev).
# In production, schema changes must come from Alembic migrations only.
if os.environ.get("CREATE_TABLES_ON_STARTUP", "").strip().lower() in ("1", "true", "yes"):
    models.Base.metadata.create_all(bind=engine)
    logger.info("create_all ran (CREATE_TABLES_ON_STARTUP is set)")
latency_tracker = APILatencyTracker(max_samples_per_key=600)

# Redis connection for WebSocket broadcasting (async client)
redis_client: Redis | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global redis_client
    try:
        redis_url = settings.REDIS_URL
        redis_client = await Redis.from_url(redis_url, decode_responses=True)
        await redis_client.ping()
        logger.info("Connected to async Redis for WebSocket broadcasting")
    except Exception as e:
        logger.warning(f"Async Redis connection failed: {e}. WebSocket broadcasting will be disabled.")
        redis_client = None
    
    yield
    
    if redis_client:
        await redis_client.aclose()

app = FastAPI(
    title="Ticketing System API",
    description="A comprehensive ticketing system for field operations",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Standardize HTTP error responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all: return 500 with safe message, log full error."""
    # SQLAlchemy / DB errors
    if "sqlalchemy" in type(exc).__module__ or "psycopg" in type(exc).__module__:
        logger.exception("Database error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "A database error occurred. Please try again.", "status_code": 500},
        )
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again.", "status_code": 500},
    )


def _latency_bucket(request: Request) -> str:
    path = request.url.path or "/"
    query = request.url.query or ""
    if path.startswith("/tickets"):
        return "tickets"
    if path.startswith("/fieldtech-companies"):
        if "for_map=true" in query:
            return "fieldtech_map"
        return "fieldtech_companies"
    if path.startswith("/sites"):
        return "sites"
    if path.startswith("/shipments"):
        return "shipments"
    return "other"

# Middlewares
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def latency_middleware(request: Request, call_next):
    start = timer_ms()
    response = await call_next(request)
    elapsed_ms = timer_ms() - start
    bucket = _latency_bucket(request)
    latency_tracker.record(bucket, elapsed_ms)
    response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.2f}"
    if elapsed_ms > 1200:
        logger.warning(
            "slow_request method=%s path=%s bucket=%s elapsed_ms=%.2f",
            request.method,
            request.url.path,
            bucket,
            elapsed_ms,
        )
    return response

# Include routers
from routers import tickets, users, sites, shipments, fieldtechs, fieldtech_companies, tasks, equipment, inventory, sla, audit, logging, search

app.include_router(tickets.router)
app.include_router(users.router)
app.include_router(sites.router)
app.include_router(shipments.router)
app.include_router(fieldtechs.router)
app.include_router(fieldtech_companies.router)
app.include_router(tasks.router)
app.include_router(equipment.router)
app.include_router(inventory.router)
app.include_router(sla.router)
app.include_router(audit.router)
app.include_router(logging.router)
app.include_router(search.router)

# Import authentication from auth module (SECRET_KEY already set above)
from utils.auth import get_current_user, require_role, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, rate_limit, rate_limit_public

# Override _enqueue_broadcast with redis_client access
def _enqueue_broadcast(background_tasks: BackgroundTasks, message: str):
    """Enqueue a WebSocket broadcast message"""
    if background_tasks:
        background_tasks.add_task(broadcast_message, message)
    else:
        # If no background tasks available, broadcast directly (for testing)
        import asyncio
        try:
            asyncio.create_task(broadcast_message(message))
        except RuntimeError:
            # No event loop running, skip broadcast
            logger.warning(f"No background tasks available, skipping broadcast: {message}")

async def broadcast_message(message: str):
    """Broadcast a message to all WebSocket connections"""
    logger.info(f"Broadcasting message: {message}")
    if redis_client:
        try:
            await redis_client.publish("websocket_updates", message)
            logger.info("Message published to Redis")
        except Exception as e:
            logger.warning(f"Redis publish failed: {e}")
            # Fallback to direct broadcast
            await manager.broadcast(message)
    else:
        # Direct broadcast when Redis is not available
        logger.info("Using direct broadcast (no Redis)")
        await manager.broadcast(message)

# Dependency injection for Redis client
async def get_redis() -> Redis | None:
    return redis_client

# Authentication endpoints
@app.post("/token")
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_public("login", limit=settings.RATE_LIMIT_LOGIN_PER_MINUTE, window_seconds=60))
):
    """Login endpoint (OAuth2 form)"""
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not user.active or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.user_id}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "must_change_password": user.must_change_password
    }

@app.post("/login")
def login_json(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_public("login", limit=settings.RATE_LIMIT_LOGIN_PER_MINUTE, window_seconds=60))
):
    """Login endpoint (form-encoded for frontend)"""
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not user.active or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.user_id}, expires_delta=access_token_expires
    )
    
    # Create refresh token (longer expiration)
    refresh_token_expires = timedelta(days=7)
    refresh_token = create_access_token(
        data={"sub": user.user_id, "type": "refresh"}, expires_delta=refresh_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "must_change_password": user.must_change_password,
        "user": {
            "user_id": user.user_id,
            "name": user.name,
            "email": user.email,
            "role": getattr(user.role, 'value', user.role),
            "phone": user.phone,
            "preferences": user.preferences,
            "active": user.active
        }
    }

from pydantic import BaseModel

class RefreshRequest(BaseModel):
    refresh_token: str

@app.post("/refresh")
def refresh_token(
    refresh_data: RefreshRequest,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_public("refresh", limit=30, window_seconds=60)),
):
    """Refresh access token"""
    refresh_token = refresh_data.refresh_token
    
    try:
        # Decode the refresh token to get the user_id
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        token_type = payload.get("type")
        
        if sub is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        # Verify it's actually a refresh token
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = str(sub)  # Ensure string for crud.get_user
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.user_id}, expires_delta=access_token_expires
    )
    
    # Create new refresh token
    refresh_token_expires = timedelta(days=7)
    new_refresh_token = create_access_token(
        data={"sub": user.user_id, "type": "refresh"}, expires_delta=refresh_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_connections[user_id] = websocket
        logger.info(f"WebSocket connected for user: {user_id}")

    def disconnect(self, websocket: WebSocket, user_id: str = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id and user_id in self.user_connections:
            del self.user_connections[user_id]
        logger.info(f"WebSocket disconnected for user: {user_id}")

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_text(message)
            except:
                # Connection is dead, remove it
                self.disconnect(self.user_connections[user_id], user_id)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Connection is dead, mark for removal
                disconnected.append(connection)
        
        # Remove dead connections
        for connection in disconnected:
            if connection in self.active_connections:
                self.active_connections.remove(connection)

manager = ConnectionManager()

# WebSocket endpoint
@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates with JWT auth via query param: ?token=..."""
    # Authenticate via JWT in query param (since headers are not available pre-accept)
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return
    
    user_id = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket, user_id)
    
    try:
        logger.info(f"WebSocket connection established for user: {user_id}")
        
        # If Redis is available, subscribe to updates
        pubsub = None
        if redis_client:
            try:
                pubsub = redis_client.pubsub()
                await pubsub.subscribe("websocket_updates")
                logger.info("Subscribed to Redis websocket_updates channel")

                async def pubsub_listener():
                    async for message in pubsub.listen():
                        if message and message.get("type") == "message":
                            await websocket.send_text(message.get("data"))

                async def ws_receiver():
                    while True:
                        try:
                            data = await websocket.receive_text()
                            if data:
                                try:
                                    parsed_data = json.loads(data)
                                    if parsed_data.get('type') == 'ping':
                                        await websocket.send_text(json.dumps({"type": "pong", "data": "connected"}))
                                except json.JSONDecodeError:
                                    pass
                        except Exception:
                            # Break on disconnect
                            break

                await asyncio.gather(pubsub_listener(), ws_receiver(), return_exceptions=True)
            except Exception as e:
                logger.warning(f"Redis subscription failed: {e}")
                # Fall back to simple keepalive + receiver
                async def keepalive():
                    while True:
                        await asyncio.sleep(60)
                        await websocket.send_text(json.dumps({"type": "ping", "timestamp": datetime.now(timezone.utc).isoformat()}))

                async def ws_receiver():
                    while True:
                        try:
                            data = await websocket.receive_text()
                            await websocket.send_text(json.dumps({"type": "pong", "data": "connected"}))
                        except Exception:
                            break

                await asyncio.gather(keepalive(), ws_receiver(), return_exceptions=True)
        else:
            # Fallback without Redis - just keepalive
            logger.info("No Redis available, using simple keepalive")
            async def keepalive():
                while True:
                    await asyncio.sleep(60)
                    await websocket.send_text(json.dumps({"type": "ping", "timestamp": datetime.now(timezone.utc).isoformat()}))

            async def ws_receiver():
                while True:
                    try:
                        data = await websocket.receive_text()
                        await websocket.send_text(json.dumps({"type": "pong", "data": "connected"}))
                    except Exception:
                        break

            await asyncio.gather(keepalive(), ws_receiver(), return_exceptions=True)
                    
    except Exception as e:
        logger.info(f"WebSocket disconnected for user {user_id}: {e}")
    finally:
        try:
            if redis_client and pubsub:
                await pubsub.unsubscribe("websocket_updates")
                await pubsub.close()
        except Exception:
            pass
        manager.disconnect(websocket, user_id)

# Health check
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/ops/latency")
def get_latency_baseline(
    current_user: models.User = Depends(require_role([models.UserRole.admin.value, models.UserRole.dispatcher.value]))
):
    """Rolling p50/p95 latency summary for hot endpoint groups."""
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": latency_tracker.summary(),
    }

# Root endpoint
@app.get("/")
def read_root():
    """Root endpoint"""
    return {"message": "Ticketing System API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
