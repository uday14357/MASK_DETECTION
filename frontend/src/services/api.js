const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocal
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1')
  : '/api/v1';

class ApiClient {
  constructor() {
    this.token = sessionStorage.getItem('maskguard_token') || localStorage.getItem('maskguard_token') || null;
  }

  setToken(token, persist = false) {
    this.token = token;
    if (token) {
      if (persist) {
        localStorage.setItem('maskguard_token', token);
      } else {
        sessionStorage.setItem('maskguard_token', token);
      }
    } else {
      localStorage.removeItem('maskguard_token');
      sessionStorage.removeItem('maskguard_token');
    }
  }

  getHeaders(isMultipart = false) {
    const headers = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async handleResponse(response) {
    if (response.status === 401) {
      this.setToken(null);
      // Trigger auth event or redirect if on protected page
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      return response.blob();
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = { message: 'Unexpected server response format' };
    }

    if (!response.ok) {
      const errorMsg = data?.detail?.message || data?.message || data?.detail || 'An error occurred';
      const errorCode = data?.detail?.code || 'API_ERROR';
      const error = new Error(errorMsg);
      error.code = errorCode;
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data;
  }

  async get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const url = `${API_BASE_URL}${endpoint}${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async post(endpoint, body, isMultipart = false) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(isMultipart),
      body: isMultipart ? body : JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async patch(endpoint, body) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async delete(endpoint) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // --- Auth APIs ---
  async login(email, password) {
    const res = await this.post('/auth/login', { email, password });
    if (res?.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  }

  async logout() {
    try {
      await this.post('/auth/logout', {});
    } finally {
      this.setToken(null);
    }
  }

  async getMe() {
    return this.get('/auth/me');
  }

  async changePassword(old_password, new_password) {
    return this.post('/auth/change-password', { old_password, new_password });
  }

  // --- Health APIs ---
  async getHealth() {
    return this.get('/health');
  }

  async getHealthReady() {
    return this.get('/health/ready');
  }

  // --- Detection APIs ---
  async detectFrame(image_base64, source_type = 'webcam', camera_id = null) {
    return this.post('/detections/frame', {
      image_base64,
      source_type,
      camera_id,
    });
  }

  async detectImage(file, camera_id = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (camera_id) {
      formData.append('camera_id', camera_id);
    }
    return this.post('/detections/image', formData, true);
  }

  // --- Cameras APIs ---
  async getCameras() {
    return this.get('/cameras');
  }

  async createCamera(payload) {
    return this.post('/cameras', payload);
  }

  async updateCamera(id, payload) {
    return this.patch(`/cameras/${id}`, payload);
  }

  async deleteCamera(id) {
    return this.delete(`/cameras/${id}`);
  }

  // --- Events APIs ---
  async getEvents(params) {
    return this.get('/events', params);
  }

  async acknowledgeEvent(id) {
    return this.patch(`/events/${id}/acknowledge`, {});
  }

  async exportEventsCsv(params) {
    return this.get('/events/export', params);
  }

  // --- Analytics APIs ---
  async getAnalyticsSummary(days = 7) {
    return this.get('/analytics/summary', { days });
  }

  async getAnalyticsTrends(days = 7) {
    return this.get('/analytics/trends', { days });
  }

  async getAnalyticsCameras() {
    return this.get('/analytics/cameras');
  }

  // --- Users APIs ---
  async getUsers() {
    return this.get('/users');
  }

  async createUser(payload) {
    return this.post('/users', payload);
  }

  async updateUser(id, payload) {
    return this.patch(`/users/${id}`, payload);
  }

  // --- Settings APIs ---
  async getSettings() {
    return this.get('/settings');
  }

  async updateSettings(payload) {
    return this.patch('/settings', payload);
  }
}

export const api = new ApiClient();
export default api;
