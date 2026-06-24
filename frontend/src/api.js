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
  getAll:           (params) => API.get('/api/products/', { params }),
  create:           (data)     => API.post('/api/products/', data),
  update:           (id, data) => API.put(`/api/products/${id}`, data),
  customize:        (id, data) => API.post(`/api/products/${id}/customize`, data),
  delete:           (id)       => API.delete(`/api/products/${id}`),
  deleteAll:        ()         => API.delete('/api/products/all'),
};

export const recipes = {
  getAll:        ()         => API.get('/api/recipes/'),
  get:           (id)       => API.get(`/api/recipes/${id}`),
  create:        (data)     => API.post('/api/recipes/', data),
  update:        (id, data) => API.put(`/api/recipes/${id}`, data),
  toggleFavorite:(id)       => API.patch(`/api/recipes/${id}/favorite`),
  updateCategory:(id, cat)  => API.patch(`/api/recipes/${id}/category`, { category: cat }),
  fetchImage:    (id)       => API.post(`/api/recipes/${id}/fetch-image`),
  delete:        (id)       => API.delete(`/api/recipes/${id}`),
  deleteAll:     ()         => API.delete('/api/recipes/all'),
};

export const mealPlan = {
  getDay:    (date, memberId)          => API.get(`/api/meal-plan/${date}`, { params: memberId ? { member_id: memberId } : {} }),
  getRange:  (start, end, memberIds)   => API.get(`/api/meal-plan/range/${start}/${end}`, { params: memberIds?.length ? { member_ids: memberIds.join(',') } : {} }),
  addMeal:   (data)                    => API.post('/api/meal-plan/', data),
  deleteMeal:(id)                      => API.delete(`/api/meal-plan/${id}`),
  copyRange: (data)                    => API.post('/api/meal-plan/copy', data),
  getSummary:(start, end, memberIds)   => API.get(`/api/meal-plan/summary/${start}/${end}`, { params: memberIds?.length ? { member_ids: memberIds.join(',') } : {} }),
};

export const members = {
  getAll:      ()        => API.get('/api/members/'),
  create:      (name)    => API.post('/api/members/', { name }),
  rename:      (id, name)=> API.patch(`/api/members/${id}`, { name }),
  delete:      (id)      => API.delete(`/api/members/${id}`),
  saveProfile: (id, data)=> API.patch(`/api/members/${id}/profile`, data),
};

export const nutrition = {
  lookup: (name, lang) => API.get('/api/nutrition/lookup', {
    params: { name, ...(lang ? { lang } : {}) },
  }),
};

export const auth = {
  changeLanguage: (lang) => API.patch('/api/auth/language', { lang }),
  exchange: (code) => API.post('/api/auth/exchange', { code }),
  login: (username, password) => API.post('/api/auth/login', { username, password }),
  register: (data) => API.post('/api/auth/register', data),
};

export const importPrices = {
  parse: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return API.post('/api/import/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  parseFree: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return API.post('/api/import/parse-free', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  apply: (updates) => API.post('/api/import/apply', { updates }),
};

export const fuel = {
  getPrices: (lang = 'pl') => API.get(`/api/fuel/prices?lang=${lang}`),
};

export const daySchedule = {
  getAll:  (memberId, weekStart) => API.get('/api/day-schedule/', {
    params: { member_id: memberId, week_start: weekStart },
  }),
  create:  (data)     => API.post('/api/day-schedule/', data),
  createBulk: (data)  => API.post('/api/day-schedule/bulk', data),
  update:  (id, data) => API.patch(`/api/day-schedule/${id}`, data),
  delete:  (id)       => API.delete(`/api/day-schedule/${id}`),
  clearWeek: (memberId, weekStart) => API.delete('/api/day-schedule/week', {
    params: { member_id: memberId, week_start: weekStart },
  }),
};
