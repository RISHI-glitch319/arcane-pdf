#!/bin/bash
# Arcane PDF Production Management Script

set -e

COMPOSE_FILE="docker-compose.yml"
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BOLD}${GREEN}=== $1 ===${NC}\n"
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}\n"
}

print_info() {
    echo -e "${YELLOW}INFO: $1${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}\n"
}

# Build images
build() {
    print_header "Building Docker Images"
    docker-compose -f $COMPOSE_FILE build --no-cache
    print_success "Build completed"
}

# Start services
start() {
    print_header "Starting Services"
    docker-compose -f $COMPOSE_FILE up -d
    print_success "Services started"
    
    # Wait for services to be healthy
    print_info "Waiting for services to be ready..."
    sleep 5
    
    status
}

# Stop services
stop() {
    print_header "Stopping Services"
    docker-compose -f $COMPOSE_FILE down
    print_success "Services stopped"
}

# Show service status
status() {
    print_header "Service Status"
    docker-compose -f $COMPOSE_FILE ps
    
    print_header "Health Checks"
    
    # Backend health
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        print_success "Backend (http://localhost:8000) is healthy"
    else
        print_error "Backend is not responding"
    fi
    
    # Frontend health
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend (http://localhost:3000) is healthy"
    else
        print_error "Frontend is not responding"
    fi
}

# View logs
logs() {
    print_header "Logs"
    docker-compose -f $COMPOSE_FILE logs -f --tail=100 "$@"
}

# Clean up volumes and data
cleanup() {
    print_header "Cleanup"
    read -p "This will remove all volumes and data. Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f $COMPOSE_FILE down -v
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Monitor resource usage
monitor() {
    print_header "Resource Usage"
    docker stats --no-stream arcanepdf-backend arcanepdf-frontend
}

# Restart services
restart() {
    print_header "Restarting Services"
    docker-compose -f $COMPOSE_FILE restart
    print_success "Services restarted"
    sleep 3
    status
}

# Backup data
backup() {
    print_header "Creating Backup"
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    docker-compose -f $COMPOSE_FILE exec -T backend tar czf - /app/temp_uploads | tar xzf - -C "$BACKUP_DIR" 2>/dev/null || true
    
    print_success "Backup created at $BACKUP_DIR"
}

# Show help
help() {
    cat << EOF
${BOLD}Arcane PDF Production Management${NC}

Usage: $0 <command> [options]

Commands:
    build       Build Docker images
    start       Start all services
    stop        Stop all services
    restart     Restart all services
    status      Show service status and health checks
    logs        View service logs (use: logs [service])
    monitor     Show resource usage
    cleanup     Remove all volumes and data (DESTRUCTIVE)
    backup      Create backup of uploads directory
    help        Show this help message

Examples:
    $0 start
    $0 logs backend
    $0 logs -f frontend
    $0 status

EOF
}

# Main
case "${1:-help}" in
    build)      build ;;
    start)      start ;;
    stop)       stop ;;
    restart)    restart ;;
    status)     status ;;
    logs)       logs "${@:2}" ;;
    monitor)    monitor ;;
    cleanup)    cleanup ;;
    backup)     backup ;;
    help)       help ;;
    *)          
        print_error "Unknown command: $1"
        help
        exit 1
        ;;
esac
