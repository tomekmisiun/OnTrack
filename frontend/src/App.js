import React, { useState } from 'react';
import Products from './components/Products';
import Recipes from './components/Recipes';
import Calendar from './components/Calendar';
import Summary from './components/Summary';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('calendar');

  const tabs = [
    { id: 'calendar', label: '📅 Kalendarz' },
    { id: 'recipes', label: '🍽️ Przepisy' },
    { id: 'products', label: '🛒 Produkty' },
    { id: 'summary', label: '📊 Podsumowanie' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>🥗 Meal Planner</h1>
        <nav className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {activeTab === 'calendar' && <Calendar />}
        {activeTab === 'recipes' && <Recipes />}
        {activeTab === 'products' && <Products />}
        {activeTab === 'summary' && <Summary />}
      </main>
    </div>
  );
}

export default App;