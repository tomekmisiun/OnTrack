import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
});

// Dołącz token do każdego żądania
API.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Przy 401 wyczyść sesję i odśwież stronę
API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const products = {
  getAll: () => API.get('/api/products/'),
  create: (data) => API.post('/api/products/', data),
  update: (id, data) => API.put(`/api/products/${id}`, data),
  delete: (id) => API.delete(`/api/products/${id}`),
};

export const recipes = {
  getAll: () => API.get('/api/recipes/'),
  get: (id) => API.get(`/api/recipes/${id}`),
  create: (data) => API.post('/api/recipes/', data),
  update: (id, data) => API.put(`/api/recipes/${id}`, data),
  updateNotes: (id, notes) => API.patch(`/api/recipes/${id}/notes`, { notes }),
  delete: (id) => API.delete(`/api/recipes/${id}`),
};

export const mealPlan = {
  getDay: (date) => API.get(`/api/meal-plan/${date}`),
  getRange: (start, end) => API.get(`/api/meal-plan/range/${start}/${end}`),
  addMeal: (data) => API.post('/api/meal-plan/', data),
  deleteMeal: (id) => API.delete(`/api/meal-plan/${id}`),
  copyRange: (data) => API.post('/api/meal-plan/copy', data),
  getSummary: (start, end) => API.get(`/api/meal-plan/summary/${start}/${end}`),
};

export const nutrition = {
  lookup: (name) => API.get(`/api/nutrition/lookup?name=${encodeURIComponent(name)}`),
};

export const importPrices = {
  parse: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return API.post('/api/import/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  apply: (updates) => API.post('/api/import/apply', { updates }),
};
