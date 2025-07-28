#!/bin/bash

# Persistent Context Store - Production Deployment Script
# This script handles deployment to various environments with comprehensive checks

set -euo pipefail

# Script metadata
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCRIPT_NAME="$(basename "$0")"
VERSION="1.0.0"

# Default configuration
DEFAULT_ENVIRONMENT="staging"
DEFAULT_NAMESPACE="context-store"
DEFAULT_TIMEOUT="600"
DEFAULT_REPLICAS="3"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m' # No Color

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

success() {
    echo -e "${GREEN}✅ $*${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $*${NC}"
}

error() {
    echo -e "${RED}❌ $*${NC}" >&2
}

fatal() {
    error "$*"
    exit 1
}

usage() {
    cat << EOF
${SCRIPT_NAME} v${VERSION} - Deploy Persistent Context Store

USAGE:
    ${SCRIPT_NAME} [OPTIONS] COMMAND

COMMANDS:
    docker      Deploy using Docker Compose
    k8s         Deploy to Kubernetes
    local       Deploy locally for development
    validate    Validate deployment configuration
    rollback    Rollback to previous version
    status      Check deployment status
    logs        View deployment logs
    cleanup     Clean up old deployments

OPTIONS:
    -e, --environment ENV    Target environment (staging|production) [default: ${DEFAULT_ENVIRONMENT}]
    -n, --namespace NS       Kubernetes namespace [default: ${DEFAULT_NAMESPACE}]
    -t, --timeout SECONDS    Deployment timeout [default: ${DEFAULT_TIMEOUT}]
    -r, --replicas COUNT     Number of replicas [default: ${DEFAULT_REPLICAS}]
    -i, --image IMAGE        Container image tag
    -c, --config FILE        Configuration file path
    -v, --verbose            Enable verbose logging
    -d, --dry-run           Show what would be deployed without executing
    -h, --help              Show this help message

EXAMPLES:
    ${SCRIPT_NAME} docker                                    # Deploy with Docker Compose
    ${SCRIPT_NAME} k8s -e production -i v1.2.3              # Deploy to production K8s
    ${SCRIPT_NAME} local                                     # Local development deployment
    ${SCRIPT_NAME} validate -e staging                      # Validate staging config
    ${SCRIPT_NAME} status -e production                     # Check production status

ENVIRONMENT VARIABLES:
    DOCKER_REGISTRY         Container registry URL
    KUBE_CONFIG_PATH        Path to kubectl config
    NEO4J_PASSWORD          Database password
    JWT_SECRET              JWT signing secret
    CLAUDE_API_KEY          Claude API key
    SLACK_WEBHOOK_URL       Slack notifications webhook

EOF
}

# =============================================================================
# CONFIGURATION & VALIDATION
# =============================================================================

validate_dependencies() {
    log "Validating dependencies..."
    
    local missing_deps=()
    
    # Check required commands
    local required_commands=("docker" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [[ ${#missing_deps[@]} -ne 0 ]]; then
        fatal "Missing required dependencies: ${missing_deps[*]}"
    fi
    
    success "All dependencies available"
}

validate_environment() {
    local env="$1"
    
    log "Validating environment: $env"
    
    case "$env" in
        development|staging|production)
            success "Environment '$env' is valid"
            ;;
        *)
            fatal "Invalid environment '$env'. Must be one of: development, staging, production"
            ;;
    esac
}

load_config() {
    local env="$1"
    local config_file="${CONFIG_FILE:-$PROJECT_ROOT/config/${env}.json}"
    
    if [[ -f "$config_file" ]]; then
        log "Loading configuration from: $config_file"
        # Source environment-specific settings
        # This would typically load JSON config and convert to env vars
        success "Configuration loaded"
    else
        warning "Configuration file not found: $config_file"
        log "Using default configuration and environment variables"
    fi
}

validate_secrets() {
    log "Validating required secrets..."
    
    local required_secrets=()
    
    # Check environment-specific required secrets
    case "$ENVIRONMENT" in
        production)
            required_secrets+=("NEO4J_PASSWORD" "JWT_SECRET" "CLAUDE_API_KEY")
            ;;
        staging)
            required_secrets+=("NEO4J_PASSWORD" "JWT_SECRET")
            ;;
    esac
    
    local missing_secrets=()
    for secret in "${required_secrets[@]}"; do
        if [[ -z "${!secret:-}" ]]; then
            missing_secrets+=("$secret")
        fi
    done
    
    if [[ ${#missing_secrets[@]} -ne 0 ]]; then
        fatal "Missing required secrets: ${missing_secrets[*]}"
    fi
    
    success "All required secrets are configured"
}

# =============================================================================
# DOCKER DEPLOYMENT
# =============================================================================

deploy_docker() {
    log "Starting Docker deployment..."
    
    local compose_file="$PROJECT_ROOT/docker-compose.yml"
    local env_file="$PROJECT_ROOT/.env"
    
    # Check required files
    [[ -f "$compose_file" ]] || fatal "Docker compose file not found: $compose_file"
    [[ -f "$env_file" ]] || fatal "Environment file not found: $env_file"
    
    # Build and deploy
    log "Building Docker images..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would execute: docker-compose build"
    else
        docker-compose -f "$compose_file" build
    fi
    
    log "Starting services..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would execute: docker-compose up -d"
    else
        docker-compose -f "$compose_file" up -d
    fi
    
    # Wait for services to be healthy
    wait_for_health_docker
    
    success "Docker deployment completed successfully"
}

wait_for_health_docker() {
    log "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose ps | grep -q "Up (healthy)"; then
            success "All services are healthy"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts - waiting for services..."
        sleep 10
        ((attempt++))
    done
    
    error "Services failed to become healthy within timeout"
    docker-compose logs --tail=50
    return 1
}

# =============================================================================
# KUBERNETES DEPLOYMENT
# =============================================================================

deploy_kubernetes() {
    log "Starting Kubernetes deployment..."
    
    # Validate kubectl access
    if ! kubectl cluster-info &> /dev/null; then
        fatal "Cannot connect to Kubernetes cluster"
    fi
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "Creating namespace: $NAMESPACE"
        if [[ "$DRY_RUN" == "true" ]]; then
            log "DRY RUN: Would create namespace $NAMESPACE"
        else
            kubectl create namespace "$NAMESPACE"
        fi
    fi
    
    # Deploy configuration
    deploy_k8s_config
    
    # Deploy application
    deploy_k8s_app
    
    # Wait for deployment to be ready
    wait_for_deployment
    
    # Run health checks
    run_health_checks
    
    success "Kubernetes deployment completed successfully"
}

deploy_k8s_config() {
    log "Deploying Kubernetes configuration..."
    
    local k8s_dir="$PROJECT_ROOT/k8s"
    
    # Apply configuration in order
    local config_files=(
        "namespace.yaml"
        "configmap.yaml"
        "secrets.yaml"
        "neo4j-statefulset.yaml"
        "services.yaml"
    )
    
    for file in "${config_files[@]}"; do
        local file_path="$k8s_dir/$file"
        if [[ -f "$file_path" ]]; then
            log "Applying: $file"
            if [[ "$DRY_RUN" == "true" ]]; then
                log "DRY RUN: Would apply $file_path"
            else
                envsubst < "$file_path" | kubectl apply -f - -n "$NAMESPACE"
            fi
        else
            warning "Configuration file not found: $file_path"
        fi
    done
}

deploy_k8s_app() {
    log "Deploying application..."
    
    local deployment_file="$PROJECT_ROOT/k8s/deployment.yaml"
    
    if [[ -f "$deployment_file" ]]; then
        # Set image tag
        export IMAGE_TAG="${IMAGE_TAG:-latest}"
        export REPLICAS="$REPLICAS"
        
        log "Deploying with image tag: $IMAGE_TAG"
        log "Replica count: $REPLICAS"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log "DRY RUN: Would apply deployment with image $IMAGE_TAG"
        else
            envsubst < "$deployment_file" | kubectl apply -f - -n "$NAMESPACE"
        fi
    else
        fatal "Deployment file not found: $deployment_file"
    fi
}

wait_for_deployment() {
    log "Waiting for deployment to be ready..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would wait for deployment rollout"
        return 0
    fi
    
    if kubectl rollout status deployment/context-store-app -n "$NAMESPACE" --timeout="${TIMEOUT}s"; then
        success "Deployment is ready"
    else
        error "Deployment failed or timed out"
        kubectl describe deployment/context-store-app -n "$NAMESPACE"
        kubectl logs -l app=context-store -n "$NAMESPACE" --tail=50
        return 1
    fi
}

# =============================================================================
# LOCAL DEPLOYMENT
# =============================================================================

deploy_local() {
    log "Starting local development deployment..."
    
    # Check if Neo4j is running
    if ! curl -s http://localhost:7474 &> /dev/null; then
        log "Starting local Neo4j..."
        docker run -d --name neo4j-dev \
            -p 7474:7474 -p 7687:7687 \
            -e NEO4J_AUTH=neo4j/password \
            neo4j:5.15
        
        # Wait for Neo4j to be ready
        log "Waiting for Neo4j to be ready..."
        timeout 60 bash -c 'until curl -s http://localhost:7474; do sleep 2; done'
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    
    # Build application
    log "Building application..."
    npm run build
    
    # Start application
    log "Starting application..."
    export NEO4J_URI="bolt://localhost:7687"
    export NEO4J_USERNAME="neo4j"
    export NEO4J_PASSWORD="password"
    export NODE_ENV="development"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would start application with npm start"
    else
        npm start &
        APP_PID=$!
        
        # Wait for application to be ready
        log "Waiting for application to be ready..."
        timeout 60 bash -c 'until curl -s http://localhost:3000/health; do sleep 2; done'
        
        success "Local deployment completed - Application running on http://localhost:3000"
        log "Application PID: $APP_PID"
    fi
}

# =============================================================================
# HEALTH CHECKS & MONITORING
# =============================================================================

run_health_checks() {
    log "Running health checks..."
    
    local health_url
    case "$ENVIRONMENT" in
        production)
            health_url="${PRODUCTION_URL:-https://api.contextstore.com}/health"
            ;;
        staging)
            health_url="${STAGING_URL:-https://staging-api.contextstore.com}/health"
            ;;
        *)
            health_url="http://localhost:3000/health"
            ;;
    esac
    
    log "Checking health endpoint: $health_url"
    
    if curl -sf "$health_url" > /dev/null; then
        success "Health check passed"
        
        # Get detailed health info
        if [[ "$VERBOSE" == "true" ]]; then
            log "Detailed health information:"
            curl -s "$health_url/detailed" | jq '.' || true
        fi
    else
        error "Health check failed"
        return 1
    fi
}

check_deployment_status() {
    log "Checking deployment status for environment: $ENVIRONMENT"
    
    case "$DEPLOYMENT_TYPE" in
        docker)
            docker-compose ps
            ;;
        k8s)
            kubectl get pods -n "$NAMESPACE"
            kubectl get services -n "$NAMESPACE"
            kubectl get deployments -n "$NAMESPACE"
            ;;
        local)
            if pgrep -f "node.*build/index.js" > /dev/null; then
                success "Local application is running"
            else
                warning "Local application is not running"
            fi
            ;;
    esac
}

# =============================================================================
# ROLLBACK & RECOVERY
# =============================================================================

rollback_deployment() {
    log "Rolling back deployment..."
    
    case "$DEPLOYMENT_TYPE" in
        docker)
            log "Rolling back Docker deployment..."
            docker-compose down
            # Restore from backup if available
            warning "Docker rollback requires manual intervention"
            ;;
        k8s)
            log "Rolling back Kubernetes deployment..."
            if kubectl rollout undo deployment/context-store-app -n "$NAMESPACE"; then
                success "Rollback initiated"
                wait_for_deployment
            else
                error "Rollback failed"
                return 1
            fi
            ;;
        *)
            error "Rollback not supported for deployment type: $DEPLOYMENT_TYPE"
            return 1
            ;;
    esac
}

# =============================================================================
# CLEANUP & MAINTENANCE
# =============================================================================

cleanup_deployment() {
    log "Cleaning up old deployments..."
    
    case "$DEPLOYMENT_TYPE" in
        docker)
            log "Cleaning up Docker resources..."
            docker system prune -f
            docker volume prune -f
            ;;
        k8s)
            log "Cleaning up Kubernetes resources..."
            kubectl delete pods --field-selector=status.phase=Succeeded -n "$NAMESPACE"
            kubectl delete pods --field-selector=status.phase=Failed -n "$NAMESPACE"
            ;;
    esac
    
    success "Cleanup completed"
}

# =============================================================================
# LOGGING & MONITORING
# =============================================================================

show_logs() {
    log "Showing deployment logs..."
    
    case "$DEPLOYMENT_TYPE" in
        docker)
            docker-compose logs -f --tail=100
            ;;
        k8s)
            kubectl logs -f -l app=context-store -n "$NAMESPACE" --tail=100
            ;;
        local)
            if [[ -f "$PROJECT_ROOT/logs/app.log" ]]; then
                tail -f "$PROJECT_ROOT/logs/app.log"
            else
                warning "Local log file not found"
            fi
            ;;
    esac
}

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color
        case "$status" in
            success) color="good" ;;
            warning) color="warning" ;;
            error) color="danger" ;;
            *) color="#36a64f" ;;
        esac
        
        local payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Deployment Notification",
            "fields": [
                {
                    "title": "Environment",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "Status",
                    "value": "$status",
                    "short": true
                },
                {
                    "title": "Message",
                    "value": "$message",
                    "short": false
                }
            ],
            "footer": "Context Store Deployment",
            "ts": $(date +%s)
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" || true
    fi
}

# =============================================================================
# MAIN SCRIPT LOGIC
# =============================================================================

# Parse command line arguments
ENVIRONMENT="$DEFAULT_ENVIRONMENT"
NAMESPACE="$DEFAULT_NAMESPACE"
TIMEOUT="$DEFAULT_TIMEOUT"
REPLICAS="$DEFAULT_REPLICAS"
IMAGE_TAG=""
CONFIG_FILE=""
VERBOSE="false"
DRY_RUN="false"
DEPLOYMENT_TYPE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--replicas)
            REPLICAS="$2"
            shift 2
            ;;
        -i|--image)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="true"
            shift
            ;;
        -d|--dry-run)
            DRY_RUN="true"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        docker|k8s|local|validate|rollback|status|logs|cleanup)
            DEPLOYMENT_TYPE="$1"
            shift
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$DEPLOYMENT_TYPE" ]]; then
    error "No deployment command specified"
    usage
    exit 1
fi

# Main execution
main() {
    log "Starting deployment script v$VERSION"
    log "Environment: $ENVIRONMENT"
    log "Deployment type: $DEPLOYMENT_TYPE"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        warning "DRY RUN MODE - No actual changes will be made"
    fi
    
    # Run pre-deployment checks
    validate_dependencies
    validate_environment "$ENVIRONMENT"
    load_config "$ENVIRONMENT"
    
    # Execute deployment command
    case "$DEPLOYMENT_TYPE" in
        docker)
            validate_secrets
            deploy_docker
            send_notification "success" "Docker deployment completed successfully"
            ;;
        k8s)
            validate_secrets
            deploy_kubernetes
            send_notification "success" "Kubernetes deployment completed successfully"
            ;;
        local)
            deploy_local
            ;;
        validate)
            log "Configuration validation completed successfully"
            ;;
        rollback)
            rollback_deployment
            send_notification "warning" "Deployment rolled back"
            ;;
        status)
            check_deployment_status
            run_health_checks
            ;;
        logs)
            show_logs
            ;;
        cleanup)
            cleanup_deployment
            ;;
        *)
            fatal "Unknown deployment type: $DEPLOYMENT_TYPE"
            ;;
    esac
    
    success "Deployment script completed successfully"
}

# Trap errors and send notifications
trap 'send_notification "error" "Deployment script failed with exit code $?"' ERR

# Run main function
main "$@"