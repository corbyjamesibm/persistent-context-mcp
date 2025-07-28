#!/bin/bash

# Persistent Context Store - Automated Backup Script
# Handles Neo4j database backups, application data backups, and cloud storage sync

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_BASE_DIR="${BACKUP_DIRECTORY:-/var/backups/contextstore}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-90}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m'

# Logging functions
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

# Create backup directory structure
create_backup_dirs() {
    local backup_dir="$BACKUP_BASE_DIR/$TIMESTAMP"
    
    mkdir -p "$backup_dir"/{neo4j,application,logs,config}
    
    log "Created backup directory: $backup_dir"
    echo "$backup_dir"
}

# Backup Neo4j database
backup_neo4j() {
    local backup_dir="$1"
    local neo4j_backup_dir="$backup_dir/neo4j"
    
    log "Starting Neo4j backup..."
    
    # Check if we're running in Kubernetes
    if command -v kubectl &> /dev/null && kubectl get pods -n context-store &> /dev/null; then
        # Kubernetes backup
        log "Performing Kubernetes Neo4j backup..."
        
        # Get Neo4j pod name  
        local neo4j_pod=$(kubectl get pods -n context-store -l app=neo4j -o jsonpath='{.items[0].metadata.name}')
        
        if [[ -z "$neo4j_pod" ]]; then
            fatal "Neo4j pod not found in Kubernetes cluster"
        fi
        
        # Create backup using neo4j-admin dump
        kubectl exec -n context-store "$neo4j_pod" -- neo4j-admin dump \
            --database=contextstore \
            --to=/tmp/neo4j_backup_${TIMESTAMP}.dump
        
        # Copy backup from pod to local filesystem
        kubectl cp "context-store/$neo4j_pod:/tmp/neo4j_backup_${TIMESTAMP}.dump" \
            "$neo4j_backup_dir/neo4j_backup_${TIMESTAMP}.dump"
        
        # Cleanup temp file in pod
        kubectl exec -n context-store "$neo4j_pod" -- rm "/tmp/neo4j_backup_${TIMESTAMP}.dump"
        
    elif command -v docker &> /dev/null && docker ps | grep -q neo4j; then
        # Docker backup
        log "Performing Docker Neo4j backup..."
        
        local neo4j_container=$(docker ps --filter "name=neo4j" --format "{{.Names}}" | head -1)
        
        if [[ -z "$neo4j_container" ]]; then
            fatal "Neo4j container not found"
        fi
        
        # Create backup using neo4j-admin dump
        docker exec "$neo4j_container" neo4j-admin dump \
            --database=contextstore \
            --to="/tmp/neo4j_backup_${TIMESTAMP}.dump"
        
        # Copy backup from container
        docker cp "$neo4j_container:/tmp/neo4j_backup_${TIMESTAMP}.dump" \
            "$neo4j_backup_dir/neo4j_backup_${TIMESTAMP}.dump"
        
        # Cleanup temp file in container
        docker exec "$neo4j_container" rm "/tmp/neo4j_backup_${TIMESTAMP}.dump"
        
    else
        # Local Neo4j backup
        log "Performing local Neo4j backup..."
        
        if command -v neo4j-admin &> /dev/null; then
            neo4j-admin dump --database=contextstore \
                --to="$neo4j_backup_dir/neo4j_backup_${TIMESTAMP}.dump"
        else
            warning "neo4j-admin not found, attempting manual backup..."
            
            # Manual backup of Neo4j data directory
            local neo4j_data_dir="${NEO4J_DATA_DIR:-/var/lib/neo4j/data}"
            
            if [[ -d "$neo4j_data_dir" ]]; then
                tar -czf "$neo4j_backup_dir/neo4j_data_${TIMESTAMP}.tar.gz" -C "$neo4j_data_dir" .
            else
                warning "Neo4j data directory not found at $neo4j_data_dir"
            fi
        fi
    fi
    
    # Verify backup file exists and has reasonable size
    local backup_file=$(find "$neo4j_backup_dir" -name "*.dump" -o -name "*.tar.gz" | head -1)
    
    if [[ -f "$backup_file" ]]; then
        local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
        
        if [[ "$backup_size" -gt 1024 ]]; then
            success "Neo4j backup completed: $(basename "$backup_file") ($(numfmt --to=iec "$backup_size"))"
        else
            warning "Neo4j backup file seems too small: $backup_size bytes"
        fi
    else
        error "Neo4j backup file not found"
        return 1
    fi
}

# Backup application data
backup_application() {
    local backup_dir="$1"
    local app_backup_dir="$backup_dir/application"
    
    log "Starting application data backup..."
    
    # Backup application logs
    if [[ -d "$PROJECT_ROOT/logs" ]]; then
        log "Backing up application logs..."
        cp -r "$PROJECT_ROOT/logs" "$backup_dir/logs/"
        success "Application logs backed up"
    fi
    
    # Backup configuration files
    if [[ -d "$PROJECT_ROOT/config" ]]; then
        log "Backing up configuration files..."
        cp -r "$PROJECT_ROOT/config" "$backup_dir/config/"
        success "Configuration files backed up"
    fi
    
    # Backup persistent volumes (if running in Kubernetes)
    if command -v kubectl &> /dev/null && kubectl get pvc -n context-store &> /dev/null; then
        log "Backing up persistent volumes..."
        
        # Get list of PVCs
        local pvcs=$(kubectl get pvc -n context-store -o jsonpath='{.items[*].metadata.name}')
        
        for pvc in $pvcs; do
            log "Backing up PVC: $pvc"
            
            # Create a backup job for each PVC
            kubectl create job "backup-$pvc-$TIMESTAMP" \
                --image=busybox \
                --namespace=context-store \
                -- sh -c "
                    mkdir -p /backup/$pvc &&
                    tar -czf /backup/$pvc/data_${TIMESTAMP}.tar.gz -C /data . &&
                    echo 'Backup completed for $pvc'
                " || warning "Failed to create backup job for $pvc"
        done
    fi
    
    # Create application metadata
    cat > "$app_backup_dir/metadata.json" << EOF
{
    "backup_timestamp": "$TIMESTAMP",
    "backup_type": "application",
    "application_version": "$(cat "$PROJECT_ROOT/package.json" | jq -r '.version' 2>/dev/null || echo 'unknown')",
    "node_version": "$(node --version 2>/dev/null || echo 'unknown')",
    "backup_size": "$(du -sh "$backup_dir" | cut -f1)",
    "environment": "${NODE_ENV:-development}"
}
EOF
    
    success "Application data backup completed"
}

# Compress backup
compress_backup() {
    local backup_dir="$1"
    local compressed_file="$BACKUP_BASE_DIR/context_store_backup_${TIMESTAMP}.tar.gz"
    
    log "Compressing backup archive..."
    
    tar -czf "$compressed_file" -C "$BACKUP_BASE_DIR" "$(basename "$backup_dir")"
    
    if [[ -f "$compressed_file" ]]; then
        local compressed_size=$(stat -f%z "$compressed_file" 2>/dev/null || stat -c%s "$compressed_file" 2>/dev/null)
        success "Backup compressed: $(basename "$compressed_file") ($(numfmt --to=iec "$compressed_size"))"
        
        # Remove uncompressed directory
        rm -rf "$backup_dir"
        
        echo "$compressed_file"
    else
        error "Failed to create compressed backup"
        return 1
    fi
}

# Upload to cloud storage
upload_to_cloud() {
    local backup_file="$1"
    
    # AWS S3 upload
    if [[ -n "${AWS_S3_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        log "Uploading backup to AWS S3..."
        
        aws s3 cp "$backup_file" "s3://$AWS_S3_BUCKET/backups/$(basename "$backup_file")" \
            --storage-class STANDARD_IA \
            --metadata "backup-timestamp=$TIMESTAMP,environment=${NODE_ENV:-production}"
        
        success "Backup uploaded to S3: s3://$AWS_S3_BUCKET/backups/$(basename "$backup_file")"
    fi
    
    # Azure Blob Storage upload
    if [[ -n "${AZURE_STORAGE_ACCOUNT:-}" ]] && command -v az &> /dev/null; then
        log "Uploading backup to Azure Blob Storage..."
        
        az storage blob upload \
            --account-name "$AZURE_STORAGE_ACCOUNT" \
            --container-name backups \
            --name "$(basename "$backup_file")" \
            --file "$backup_file" \
            --tier Cool
        
        success "Backup uploaded to Azure: $AZURE_STORAGE_ACCOUNT/backups/$(basename "$backup_file")"
    fi
    
    # Google Cloud Storage upload
    if [[ -n "${GCP_BUCKET:-}" ]] && command -v gsutil &> /dev/null; then
        log "Uploading backup to Google Cloud Storage..."
        
        gsutil -m cp "$backup_file" "gs://$GCP_BUCKET/backups/"
        gsutil lifecycle set - "gs://$GCP_BUCKET" << EOF
{
    "rule": [
        {
            "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
            "condition": {"age": 30, "matchesStorageClass": ["STANDARD"]}
        },
        {
            "action": {"type": "Delete"},
            "condition": {"age": $RETENTION_DAYS}
        }
    ]
}
EOF
        
        success "Backup uploaded to GCS: gs://$GCP_BUCKET/backups/$(basename "$backup_file")"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_BASE_DIR" -name "context_store_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    local deleted_count=0
    
    # AWS S3 cleanup
    if [[ -n "${AWS_S3_BUCKET:-}" ]] && command -v aws &> /dev/null; then
        local old_backups=$(aws s3 ls "s3://$AWS_S3_BUCKET/backups/" \
            --query "Contents[?LastModified<='$(date -d "$RETENTION_DAYS days ago" -Iseconds)'].Key" \
            --output text)
        
        for backup in $old_backups; do
            aws s3 rm "s3://$AWS_S3_BUCKET/$backup"
            ((deleted_count++))
        done
    fi
    
    # Azure Blob Storage cleanup
    if [[ -n "${AZURE_STORAGE_ACCOUNT:-}" ]] && command -v az &> /dev/null; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" -Iseconds)
        
        az storage blob list \
            --account-name "$AZURE_STORAGE_ACCOUNT" \
            --container-name backups \
            --query "[?properties.lastModified<='$cutoff_date'].name" \
            --output tsv | while read -r blob; do
            
            az storage blob delete \
                --account-name "$AZURE_STORAGE_ACCOUNT" \
                --container-name backups \
                --name "$blob"
            ((deleted_count++))
        done
    fi
    
    # Google Cloud Storage cleanup (handled by lifecycle policy)
    
    if [[ $deleted_count -gt 0 ]]; then
        success "Cleaned up $deleted_count old backup files"
    else
        log "No old backups found to clean up"
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    local backup_file="$3"
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color
        case "$status" in
            success) color="good" ;;
            warning) color="warning" ;;
            error) color="danger" ;;
        esac
        
        local backup_size=""
        if [[ -f "$backup_file" ]]; then
            backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
            backup_size=" ($(numfmt --to=iec "$backup_size"))"
        fi
        
        local payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Context Store Backup Notification",
            "fields": [
                {
                    "title": "Status",
                    "value": "$status",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$TIMESTAMP",
                    "short": true
                },
                {
                    "title": "Backup File",
                    "value": "$(basename "$backup_file")$backup_size",
                    "short": false
                },
                {
                    "title": "Message",
                    "value": "$message",
                    "short": false
                }
            ],
            "footer": "Context Store Backup System",
            "ts": $(date +%s)
        }
    ]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "$SLACK_WEBHOOK_URL" &> /dev/null || true
    fi
    
    # Email notification (if configured)
    if [[ -n "${NOTIFICATION_EMAIL:-}" ]] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "Context Store Backup $status" "$NOTIFICATION_EMAIL"
    fi
}

# Health check before backup
health_check() {
    log "Performing health check before backup..."
    
    # Check if application is running
    local health_url="${HEALTH_CHECK_URL:-http://localhost:3000/health}"
    
    if curl -sf "$health_url" &> /dev/null; then
        success "Application health check passed"
    else
        warning "Application health check failed, continuing with backup..."
    fi
    
    # Check available disk space
    local backup_disk_usage=$(df "$BACKUP_BASE_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $backup_disk_usage -gt 90 ]]; then
        warning "Backup disk usage is high: $backup_disk_usage%"
        
        # Cleanup old backups early if disk is full
        cleanup_old_backups
    fi
    
    success "Health check completed"
}

# Main backup function
perform_backup() {
    log "Starting Context Store backup process..."
    
    # Pre-backup health check
    health_check
    
    # Create backup directory
    local backup_dir
    backup_dir=$(create_backup_dirs)
    
    # Perform backups
    backup_neo4j "$backup_dir"
    backup_application "$backup_dir"
    
    # Compress backup
    local compressed_backup
    compressed_backup=$(compress_backup "$backup_dir")
    
    # Upload to cloud storage
    upload_to_cloud "$compressed_backup"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Send success notification
    send_notification "success" "Backup completed successfully" "$compressed_backup"
    
    success "Backup process completed successfully"
    log "Backup file: $compressed_backup"
    
    # Return backup file path for use by calling scripts
    echo "$compressed_backup"
}

# Script entry point
main() {
    log "Context Store Backup Script v1.0.0"
    log "Timestamp: $TIMESTAMP"
    log "Backup directory: $BACKUP_BASE_DIR"
    log "Retention days: $RETENTION_DAYS"
    
    # Trap errors and send failure notifications
    trap 'send_notification "error" "Backup process failed" ""' ERR
    
    # Perform the backup
    perform_backup
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi