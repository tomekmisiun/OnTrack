import React, { useState, useEffect } from 'react';
import { recipes as api, products as productsApi } from '../api';

function Recipes() {
  const [recipeList, setRecipeList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [form, setForm] = useState({ name: '', ingredients: [] });
  const [ingredient, setIngredient] = useState({ product_id: '', weight: '' });
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRecipes();
    loadProducts();
  }, []);

  const loadRecipes = async () => {
    try {
      const res = await api.getAll();
      setRecipeList(res.data);
    } catch (e) {
      setError('Błąd ładowania przepisów');
    }
  };

  const loadProducts = async () => {
    try {
      const res = await productsApi.getAll();
      setProductList(res.data);
    } catch (e) {
      setError('Błąd ładowania produktów');
    }
  };

  const addIngredient = () => {
    if (!ingredient.product_id || !ingredient.weight) {
      setError('Wybierz produkt i podaj gramaturę');
      return;
    }
    const product = productList.find(p => p.id === parseInt(ingredient.product_id));
    setForm({
      ...form,
      ingredients: [...form.ingredients, {
        product_id: parseInt(ingredient.product_id),
        product_name: product.name,
        weight: parseFloat(ingredient.weight),
      }]
    });
    setIngredient({ product_id: '', weight: '' });
    setError('');
  };

  const removeIngredient = (index) => {
    setForm({
      ...form,
      ingredients: form.ingredients.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async () => {
    if (!form.name) {
      setError('Podaj nazwę przepisu');
      return;
    }
    if (form.ingredients.length === 0) {
      setError('Dodaj przynajmniej jeden składnik');
      return;
    }
    try {
      await api.create({
        name: form.name,
        ingredients: form.ingredients.map(i => ({
          product_id: i.product_id,
          weight: i.weight,
        }))
      });
      setForm({ name: '', ingredients: [] });
      setError('');
      loadRecipes();
    } catch (e) {
      setError(e.response?.data?.error || 'Błąd dodawania przepisu');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Usunąć przepis?')) return;
    try {
      await api.delete(id);
      loadRecipes();
    } catch (e) {
      setError('Błąd usuwania przepisu');
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Dodaj przepis</h2>
        {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
        <div className="form-row">
          <input
            placeholder="Nazwa przepisu"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div className="form-row">
          <select
            value={ingredient.product_id}
            onChange={e => setIngredient({ ...ingredient, product_id: e.target.value })}
          >
            <option value="">Wybierz produkt</option>
            {productList.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.package_weight}g)</option>
            ))}
          </select>
          <input
            placeholder="Gramatura (g)"
            type="number"
            value={ingredient.weight}
            onChange={e => setIngredient({ ...ingredient, weight: e.target.value })}
          />
          <button className="btn btn-success" onClick={addIngredient}>
            + Składnik
          </button>
        </div>

        {form.ingredients.length > 0 && (
          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Gramatura</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {form.ingredients.map((ing, i) => (
                <tr key={i}>
                  <td>{ing.product_name}</td>
                  <td>{ing.weight}g</td>
                  <td>
                    <button className="btn btn-danger" onClick={() => removeIngredient(i)}>
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button className="btn btn-primary" onClick={handleSubmit}>
          Zapisz przepis
        </button>
      </div>

      <div className="card">
        <h2>Lista przepisów</h2>
        {recipeList.map(r => (
          <div key={r.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{r.name}</strong>
                <span style={{ marginLeft: 12, color: '#667eea' }}>
                  {r.total_cost.toFixed(2)} zł
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  {expanded === r.id ? 'Zwiń' : 'Składniki'}
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(r.id)}>
                  Usuń
                </button>
              </div>
            </div>
            {expanded === r.id && (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>Gramatura</th>
                    <th>Koszt</th>
                  </tr>
                </thead>
                <tbody>
                  {r.ingredients.map(ing => (
                    <tr key={ing.id}>
                      <td>{ing.product_name}</td>
                      <td>{ing.weight}g</td>
                      <td>{ing.cost.toFixed(2)} zł</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {recipeList.length === 0 && (
          <p style={{ textAlign: 'center', color: '#999' }}>
            Brak przepisów — dodaj pierwszy!
          </p>
        )}
      </div>
    </div>
  );
}

export default Recipes;