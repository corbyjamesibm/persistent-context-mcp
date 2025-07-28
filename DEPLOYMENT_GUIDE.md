# Persistent Context Store - Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18+ 
- **Neo4j**: v5.0+
- **Docker**: v20+ (for containerized deployment)
- **Redis**: v6+ (optional, for session caching)

### Basic Deployment (5 minutes)
```bash
# 1. Clone and install
git clone <repository-url>
cd persistent-context-store
npm install

# 2. Set up Neo4j database
docker run -d \
  --name neo4j-contextstore \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your-password \
  -v neo4j_data:/data \
  -v neo4j_logs:/logs \
  neo4j:5.15

# 3. Configure environment
cp .env.example .env
# Edit .env with your settings

# 4. Initialize database
npm run db:migrate

# 5. Start the application
npm run start

# ✅ Service available at http://localhost:3000
```

## 🐳 Docker Deployment

### Single Container
```dockerfile
# Dockerfile (already included)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t context-store .
docker run -p 3000:3000 \
  -e NEO4J_URI=bolt://neo4j:7687 \
  -e NEO4J_USERNAME=neo4j \
  -e NEO4J_PASSWORD=your-password \
  context-store
```

### Docker Compose (Recommended)
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USERNAME=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - neo4j
    volumes:
      - ./backups:/app/backups
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  neo4j:
    image: neo4j:5.15
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_PLUGINS=["apoc"]
      - NEO4J_dbms_security_procedures_unrestricted=apoc.*
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "${NEO4J_PASSWORD}", "RETURN 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  neo4j_data:
  neo4j_logs:
  neo4j_import:
  neo4j_plugins:
  redis_data:
```

```bash
# Deploy with Docker Compose
cp .env.example .env
# Configure your environment variables
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f app
```

## ☸️ Kubernetes Deployment

### Namespace Setup
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: context-store
  labels:
    name: context-store
```

### ConfigMap
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: context-store-config
  namespace: context-store
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://your-domain.com"
  NEO4J_URI: "bolt://neo4j-service:7687"
  NEO4J_DATABASE: "contextstore"
  HEALTH_CHECK_INTERVAL: "30000"
  BACKUP_DIRECTORY: "/var/backups"
```

### Secrets
```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: context-store-secrets
  namespace: context-store
type: Opaque
data:
  NEO4J_USERNAME: bmVvNGo=  # base64: neo4j
  NEO4J_PASSWORD: eW91ci1wYXNzd29yZA==  # base64: your-password
  JWT_SECRET: eW91ci1qd3Qtc2VjcmV0  # base64: your-jwt-secret
  CLAUDE_API_KEY: bGxtX2NsYXVkZV9rZXk=  # base64: llm_claude_key
```

### Application Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: context-store-app
  namespace: context-store
  labels:
    app: context-store
spec:
  replicas: 3
  selector:
    matchLabels:
      app: context-store
  template:
    metadata:
      labels:
        app: context-store
    spec:
      containers:
      - name: context-store
        image: context-store:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: context-store-config
        - secretRef:
            name: context-store-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: backup-storage
          mountPath: /var/backups
        - name: log-storage
          mountPath: /app/logs
      volumes:
      - name: backup-storage
        persistentVolumeClaim:
          claimName: backup-pvc
      - name: log-storage
        persistentVolumeClaim:
          claimName: logs-pvc
```

### Neo4j StatefulSet
```yaml
# k8s/neo4j-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: neo4j
  namespace: context-store
spec:
  serviceName: neo4j-service
  replicas: 1
  selector:
    matchLabels:
      app: neo4j
  template:
    metadata:
      labels:
        app: neo4j
    spec:
      containers:
      - name: neo4j
        image: neo4j:5.15
        ports:
        - containerPort: 7474
        - containerPort: 7687
        env:
        - name: NEO4J_AUTH
          valueFrom:
            secretKeyRef:
              name: context-store-secrets
              key: NEO4J_AUTH
        - name: NEO4J_PLUGINS
          value: '["apoc"]'
        resources:
          requests:
            memory: "2Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
        - name: neo4j-data
          mountPath: /data
        - name: neo4j-logs
          mountPath: /logs
  volumeClaimTemplates:
  - metadata:
      name: neo4j-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 50Gi
  - metadata:
      name: neo4j-logs
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### Services
```yaml
# k8s/services.yaml
apiVersion: v1
kind: Service
metadata:
  name: context-store-service
  namespace: context-store
spec:
  selector:
    app: context-store
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: v1
kind: Service
metadata:
  name: neo4j-service
  namespace: context-store
spec:
  selector:
    app: neo4j
  ports:
  - name: http
    port: 7474
    targetPort: 7474
  - name: bolt
    port: 7687
    targetPort: 7687
  type: ClusterIP
```

### Ingress
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: context-store-ingress
  namespace: context-store
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "1000"
spec:
  tls:
  - hosts:
    - api.your-domain.com
    secretName: context-store-tls
  rules:
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: context-store-service
            port:
              number: 3000
```

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/neo4j-statefulset.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment status
kubectl get pods -n context-store
kubectl logs -f deployment/context-store-app -n context-store
```

## 🔧 Environment Configuration

### Production Environment Variables
```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-secure-password
NEO4J_DATABASE=contextstore

# Security
JWT_SECRET=your-very-secure-jwt-secret-min-32-chars
SESSION_SECRET=your-secure-session-secret
API_RATE_LIMIT=10000
CORS_ORIGIN=https://your-domain.com

# LLM Integration
CLAUDE_API_KEY=llm_your_claude_api_key_here
LLM_API_KEY=llm_your_general_llm_key_here

# Monitoring
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000
PERFORMANCE_MONITORING=true
METRICS_COLLECTION=true

# Storage
BACKUP_DIRECTORY=/var/backups/contextstore
BACKUP_RETENTION_DAYS=90

# Cache (optional)
REDIS_URL=redis://redis:6379
CACHE_TTL=3600

# SSL/TLS (if handling SSL at app level)
SSL_CERT_PATH=/etc/ssl/certs/app.crt
SSL_KEY_PATH=/etc/ssl/private/app.key
```

### Configuration Validation
```bash
# Validate configuration
npm run config:validate

# Test database connection
npm run db:test

# Check all health endpoints
npm run health:check
```

## 🔒 Security Setup

### SSL/TLS Configuration
```bash
# Generate self-signed certificates (development)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Production: Use Let's Encrypt or commercial certificates
# Place certificates in secure location and update environment variables
```

### Firewall Configuration
```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # App
sudo ufw allow 7687/tcp  # Neo4j Bolt (internal only)
sudo ufw deny 7474/tcp   # Neo4j HTTP (deny external)
sudo ufw enable

# iptables example
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
iptables -A INPUT -p tcp --dport 7687 -s localhost -j ACCEPT
iptables -A INPUT -p tcp --dport 7474 -j DROP
```

### User Management
```bash
# Create dedicated user
sudo useradd -r -m -s /bin/bash contextstore
sudo usermod -aG docker contextstore

# Set up directory permissions
sudo mkdir -p /var/log/contextstore
sudo mkdir -p /var/backups/contextstore
sudo chown -R contextstore:contextstore /var/log/contextstore
sudo chown -R contextstore:contextstore /var/backups/contextstore
```

## 📊 Monitoring Setup

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Detailed health with metrics
curl http://localhost:3000/health/detailed

# Database health
curl http://localhost:3000/health/database

# Performance metrics
curl http://localhost:3000/api/v1/performance/metrics
```

### Log Management
```bash
# Configure log rotation
sudo tee /etc/logrotate.d/contextstore <<EOF
/var/log/contextstore/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    create 644 contextstore contextstore
    postrotate
        systemctl reload contextstore || true
    endscript
}
EOF
```

### Prometheus Metrics (Optional)
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'context-store'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: /metrics
    scrape_interval: 10s
```

## 🔄 Backup & Recovery

### Automated Backup Setup
```bash
# Create backup script
sudo tee /usr/local/bin/contextstore-backup.sh <<EOF
#!/bin/bash
BACKUP_DIR="/var/backups/contextstore"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR/$TIMESTAMP

# Neo4j backup
neo4j-admin dump --database=contextstore --to=$BACKUP_DIR/$TIMESTAMP/neo4j_backup.dump

# Application backup
curl -X POST http://localhost:3000/api/v1/backup/create \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"includeFiles": true}' \
  -o $BACKUP_DIR/$TIMESTAMP/app_backup.tar.gz

# Cleanup old backups (keep 90 days)
find $BACKUP_DIR -type d -mtime +90 -exec rm -rf {} +

echo "Backup completed: $BACKUP_DIR/$TIMESTAMP"
EOF

chmod +x /usr/local/bin/contextstore-backup.sh
```

```bash
# Set up cron job for daily backups
crontab -e
# Add line:
0 2 * * * /usr/local/bin/contextstore-backup.sh >> /var/log/contextstore/backup.log 2>&1
```

### Recovery Procedures
```bash
# Stop application
sudo systemctl stop contextstore

# Restore Neo4j database
neo4j-admin load --from=/var/backups/contextstore/20240128_020000/neo4j_backup.dump --database=contextstore --force

# Restore application data
tar -xzf /var/backups/contextstore/20240128_020000/app_backup.tar.gz -C /

# Start application
sudo systemctl start contextstore

# Verify recovery
curl http://localhost:3000/health
```

## 🚦 Process Management

### Systemd Service (Linux)
```ini
# /etc/systemd/system/contextstore.service
[Unit]
Description=Persistent Context Store
After=network.target neo4j.service
Wants=neo4j.service

[Service]
Type=simple
User=contextstore
Group=contextstore
WorkingDirectory=/opt/contextstore
Environment=NODE_ENV=production
EnvironmentFile=/opt/contextstore/.env
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=contextstore

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/contextstore /var/backups/contextstore

[Install]
WantedBy=multi-user.target
```

```bash
# Install and start service
sudo systemctl daemon-reload
sudo systemctl enable contextstore
sudo systemctl start contextstore
sudo systemctl status contextstore
```

### PM2 Process Manager (Alternative)
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
tee ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'context-store',
    script: 'build/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/contextstore/error.log',
    out_file: '/var/log/contextstore/out.log',
    log_file: '/var/log/contextstore/combined.log',
    time: true
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check Neo4j status
sudo systemctl status neo4j

# Test connection
cypher-shell -u neo4j -p your-password "RETURN 1"

# Check logs
sudo journalctl -u neo4j -f
```

#### Application Won't Start
```bash
# Check logs
sudo journalctl -u contextstore -f

# Verify environment
node -e "console.log(process.env)"

# Test configuration
npm run config:validate
```

#### Performance Issues
```bash
# Check resource usage
htop
iostat -x 1
free -h

# Application metrics
curl http://localhost:3000/api/v1/performance/metrics

# Database performance
cypher-shell -u neo4j -p password "CALL dbms.queryJmx('*:*')"
```

### Debug Mode
```bash
# Start in debug mode
NODE_ENV=development DEBUG=* npm start

# Enable verbose logging
LOG_LEVEL=debug npm start
```

## 📈 Performance Tuning

### Neo4j Optimization
```bash
# /etc/neo4j/neo4j.conf
dbms.memory.heap.initial_size=2G
dbms.memory.heap.max_size=4G
dbms.memory.pagecache.size=2G
dbms.tx_log.rotation.retention_policy=7 days
```

### Node.js Optimization
```bash
# Set Node.js options
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# Use production optimizations
npm run build --production
```

### Load Balancing (Multiple Instances)
```yaml
# nginx.conf
upstream context_store {
    server 127.0.0.1:3000 weight=1;
    server 127.0.0.1:3001 weight=1;
    server 127.0.0.1:3002 weight=1;
}

server {
    listen 80;
    server_name api.your-domain.com;
    
    location / {
        proxy_pass http://context_store;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🎯 Production Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Backup system tested
- [ ] Monitoring endpoints verified
- [ ] Load testing completed

### Post-Deployment
- [ ] Health checks passing
- [ ] Application logs clean
- [ ] Database connectivity verified
- [ ] API endpoints responding
- [ ] Backup job scheduled
- [ ] Monitoring alerts configured
- [ ] Performance baseline established

### Ongoing Maintenance
- [ ] Regular security updates
- [ ] Backup verification
- [ ] Performance monitoring
- [ ] Log rotation
- [ ] Capacity planning
- [ ] Documentation updates

The system is now ready for production deployment! 🚀