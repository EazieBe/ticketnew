#!/bin/bash

# Ticketing System Startup Script
# This script ensures the app always uses the correct ports and handles conflicts

set -e  # Exit on any error

echo "🚀 Starting Ticketing System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local process_name=$2
    
    print_status "Checking for processes on port $port..."
    
    # Find processes using the port
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ ! -z "$pids" ]; then
        print_warning "Found processes using port $port: $pids"
        print_status "Killing processes on port $port..."
        
        for pid in $pids; do
            if kill -0 $pid 2>/dev/null; then
                kill $pid
                print_status "Killed process $pid"
            fi
        done
        
        # Wait a moment for processes to fully terminate
        sleep 2
        
        # Double-check port is free
        if lsof -ti:$port >/dev/null 2>&1; then
            print_warning "Port $port still in use, force killing..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 1
        fi
        
        print_success "Port $port is now free"
    else
        print_status "Port $port is already free"
    fi
}

# Function to check if a port is free
check_port() {
    local port=$1
    if lsof -ti:$port >/dev/null 2>&1; then
        return 1  # Port is in use
    else
        return 0  # Port is free
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready on $host:$port..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Get the script directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

cd "$PROJECT_ROOT"

print_status "Working directory: $PROJECT_ROOT"

# Mode selection
# ENV=dev (or APP_MODE=dev): backend --reload + frontend npm start (HMR)
# default/prod: backend workers + frontend serve build
APP_MODE="${APP_MODE:-$ENV}"
if [ "$APP_MODE" = "dev" ]; then
    APP_MODE="dev"
else
    APP_MODE="prod"
fi
print_status "Startup mode: $APP_MODE"

# Kill any existing processes on our target ports
kill_port 8000 "Backend"
kill_port 3000 "Frontend"

# Check if virtual environment exists
if [ ! -d "$PROJECT_ROOT/venv" ]; then
    print_error "Virtual environment not found. Please run: python3 -m venv venv"
    exit 1
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source "$PROJECT_ROOT/venv/bin/activate"

# Install/update Python dependencies
print_status "Checking Python dependencies..."
pip install -r requirements.txt >/dev/null 2>&1 || print_warning "Could not install requirements.txt (file may not exist)"

# Start backend server
print_status "Starting backend server on port 8000..."
cd "$BACKEND_DIR"
BACKEND_LOG="$PROJECT_ROOT/backend_uvicorn.log"
if [ "$APP_MODE" = "dev" ]; then
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload >"$BACKEND_LOG" 2>&1 &
else
  WORKERS=${BACKEND_WORKERS:-2}
  uvicorn main:app --host 0.0.0.0 --port 8000 --workers "$WORKERS" >"$BACKEND_LOG" 2>&1 &
fi
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for backend to be ready
if wait_for_service "localhost" 8000 "Backend API"; then
    print_success "Backend server started successfully (PID: $BACKEND_PID)"
else
    print_error "Backend server failed to start"
    exit 1
fi

# Check if frontend build exists
# Start frontend server
print_status "Starting frontend server on port 3000..."
cd "$FRONTEND_DIR"
FRONTEND_LOG="$PROJECT_ROOT/frontend_serve.log"
if [ "$APP_MODE" = "dev" ]; then
    # CRA dev server with HMR
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    BROWSER=none npm start >"$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
else
    if [ ! -d "build" ]; then
        print_warning "Frontend build not found. Building frontend..."
        npm install >/dev/null 2>&1 || true
        npm run build
    fi
    npx serve -s build -l 3000 --single >"$FRONTEND_LOG" 2>&1 &
    FRONTEND_PID=$!
fi
cd "$PROJECT_ROOT"

# Wait for frontend to be ready
if wait_for_service "localhost" 3000 "Frontend"; then
    print_success "Frontend server started successfully (PID: $FRONTEND_PID)"
else
    print_error "Frontend server failed to start"
    exit 1
fi

# Save PIDs to file for easy cleanup
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

print_success "🎉 Ticketing System is now running!"
echo ""
echo "📱 Access the application at:"
echo "   Frontend: http://192.168.43.50:3000"
echo "   Backend API: http://192.168.43.50:8000"
echo ""
echo "🔧 To stop the application, run: ./stop_app.sh"
echo "🔄 To restart the application, run: ./restart_app.sh"
echo "🧭 Mode: $APP_MODE"
echo "🪵 Backend log: $BACKEND_LOG"
echo "🪵 Frontend log: $FRONTEND_LOG"
echo ""
echo "📊 Process IDs:"
echo "   Backend: $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""

# Function to handle script termination
cleanup() {
    print_status "Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    rm -f .backend.pid .frontend.pid
    print_success "Servers stopped"
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running and monitor processes
print_status "Monitoring servers... (Press Ctrl+C to stop)"
while true; do
    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend server stopped unexpectedly"
        break
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend server stopped unexpectedly"
        break
    fi
    sleep 5
done

cleanup
