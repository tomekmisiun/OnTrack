import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001',
});

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