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
  getAll:           ()         => API.get('/api/products/'),
  create:           (data)     => API.post('/api/products/', data),
  update:           (id, data) => API.put(`/api/products/${id}`, data),
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
  getParseLimit: ()         => API.get('/api/recipes/parse-limit'),
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
  lookup: (name) => API.get(`/api/nutrition/lookup?name=${encodeURIComponent(name)}`),
};

export const auth = {
  changeLanguage: (lang) => API.patch('/api/auth/language', { lang }),
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
