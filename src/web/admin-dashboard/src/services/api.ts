import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

class ApiService {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth-token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError) => {
        // Handle common errors
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('auth-token');
          window.location.href = '/login';
        }

        // Transform error for consistent handling
        const apiError: ApiError = {
          message: (error.response?.data as any)?.message || error.message || 'An error occurred',
          code: (error.response?.data as any)?.code || error.code,
          details: (error.response?.data as any)?.details,
        };

        return Promise.reject(apiError);
      }
    );
  }

  setAuthToken(token: string) {
    this.instance.defaults.headers.Authorization = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.instance.defaults.headers.Authorization;
  }

  // Generic HTTP methods
  async get<T = any>(url: string, params?: any): Promise<AxiosResponse<T>> {
    return this.instance.get(url, { params });
  }

  async post<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.instance.post(url, data);
  }

  async put<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.instance.put(url, data);
  }

  async patch<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.instance.patch(url, data);
  }

  async delete<T = any>(url: string): Promise<AxiosResponse<T>> {
    return this.instance.delete(url);
  }

  // File upload with progress tracking
  async uploadFile<T = any>(
    url: string,
    file: File,
    onUploadProgress?: (progress: number) => void
  ): Promise<AxiosResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.instance.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(progress);
        }
      },
    });
  }

  // Specific API endpoints
  
  // Authentication
  async login(email: string, password: string) {
    return this.post('/auth/login', { email, password });
  }

  async logout() {
    return this.post('/auth/logout');
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }

  async refreshToken() {
    return this.post('/auth/refresh');
  }

  // System Health
  async getSystemHealth() {
    return this.get('/system/health');
  }

  async getDetailedSystemHealth() {
    return this.get('/system/health/detailed');
  }

  async getHealthMetricsHistory(limit?: number) {
    return this.get('/system/health/history', { limit });
  }

  // Performance
  async getPerformanceMetrics() {
    return this.get('/system/performance');
  }

  async runLoadTest(config: {
    concurrentUsers: number;
    duration: number;
    rampUpTime: number;
  }) {
    return this.post('/system/performance/load-test', config);
  }

  async getPerformanceHistory(limit?: number) {
    return this.get('/system/performance/history', { limit });
  }

  async analyzePerformance() {
    return this.get('/system/performance/analyze');
  }

  // Context Management
  async getContexts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    tags?: string[];
  }) {
    return this.get('/contexts', params);
  }

  async getContext(id: string) {
    return this.get(`/contexts/${id}`);
  }

  async createContext(data: {
    title: string;
    content: string;
    type: string;
    tags?: string[];
    sessionId: string;
  }) {
    return this.post('/contexts', data);
  }

  async updateContext(id: string, data: Partial<{
    title: string;
    content: string;
    type: string;
    tags: string[];
  }>) {
    return this.patch(`/contexts/${id}`, data);
  }

  async deleteContext(id: string) {
    return this.delete(`/contexts/${id}`);
  }

  async searchContexts(query: string, filters?: any) {
    return this.post('/contexts/search', { query, filters });
  }

  // User Management
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) {
    return this.get('/users', params);
  }

  async getUser(id: string) {
    return this.get(`/users/${id}`);
  }

  async createUser(data: {
    email: string;
    name: string;
    role: string;
    password: string;
  }) {
    return this.post('/users', data);
  }

  async updateUser(id: string, data: Partial<{
    email: string;
    name: string;
    role: string;
    permissions: string[];
  }>) {
    return this.patch(`/users/${id}`, data);
  }

  async deleteUser(id: string) {
    return this.delete(`/users/${id}`);
  }

  // Collaboration
  async getCollaborationSessions() {
    return this.get('/collaboration/sessions');
  }

  async createCollaborationSession(data: {
    name: string;
    maxParticipants?: number;
    allowGuests?: boolean;
    conflictResolution?: string;
  }) {
    return this.post('/collaboration/sessions', data);
  }

  async joinCollaborationSession(sessionId: string, data: {
    displayName: string;
    role?: string;
  }) {
    return this.post(`/collaboration/sessions/${sessionId}/join`, data);
  }

  async leaveCollaborationSession(sessionId: string) {
    return this.post(`/collaboration/sessions/${sessionId}/leave`);
  }

  async addCollaborationComment(sessionId: string, data: {
    contextId: string;
    content: string;
    position: number;
    mentions?: string[];
  }) {
    return this.post(`/collaboration/sessions/${sessionId}/comments`, data);
  }

  // Data Migration
  async exportData(dataType: string, options: any) {
    return this.post('/data-migration/export', { dataType, options });
  }

  async importData(file: File, dataType: string, options: any, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataType', dataType);
    formData.append('options', JSON.stringify(options));

    return this.instance.post('/data-migration/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }

  async validateImportFile(file: File, dataType: string, options: any) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dataType', dataType);
    formData.append('options', JSON.stringify(options));

    return this.instance.post('/data-migration/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async getMigrationOperations() {
    return this.get('/data-migration/operations/active');
  }

  async getMigrationHistory(limit?: number) {
    return this.get('/data-migration/operations/history', { limit });
  }

  async cancelMigrationOperation(operationId: string) {
    return this.post(`/data-migration/operations/${operationId}/cancel`);
  }

  async getMigrationProgress(operationId: string) {
    return this.get(`/data-migration/operations/${operationId}/progress`);
  }

  async getDataTemplates() {
    return this.get('/data-migration/templates');
  }

  async createDataTemplate(data: any) {
    return this.post('/data-migration/templates', data);
  }

  // Backup & Recovery
  async createBackup(type: 'full' | 'incremental' = 'full') {
    return this.post('/backups', { type });
  }

  async getBackups() {
    return this.get('/backups');
  }

  async restoreBackup(backupId: string, options?: {
    validateChecksum?: boolean;
    overwriteExisting?: boolean;
  }) {
    return this.post(`/backups/${backupId}/restore`, options);
  }

  async validateBackup(backupId: string) {
    return this.get(`/backups/${backupId}/validate`);
  }

  async getBackupStatus() {
    return this.get('/backups/status');
  }

  // Settings
  async getSettings() {
    return this.get('/settings');
  }

  async updateSettings(data: any) {
    return this.patch('/settings', data);
  }

  async resetSettings() {
    return this.post('/settings/reset');
  }
}

export const api = new ApiService();