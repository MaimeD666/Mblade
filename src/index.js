// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './ThemeStyles.css'; // Импортируем стили для тем
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initTheme } from './theme';

// Инициализируем тему (устанавливаются CSS-переменные из сохранённого или дефолтного варианта)
initTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();