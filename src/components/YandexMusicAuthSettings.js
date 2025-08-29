import React, { useState, useEffect, useRef } from 'react';
import { getYandexMusicAuthStatus, loginYandexMusic, logoutYandexMusic } from '../services/api';

const YandexMusicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="currentColor">
    <path fill="#212121" d="M24.001,44.001c11.045,0,20-8.955,20-20s-8.955-20-20-20    c-11.045,0-20,8.955-20,20S12.956,44.001,24.001,44.001z"></path>
    <path fill="#fcbe2d" d="M39.2,20.019l-0.129-0.607l-5.097-0.892l2.968-4.021    L36.6,14.104l-4.364,2.104l0.552-5.573l-0.447-0.261l-2.655,4.52l-2.971-6.728h-0.524l0.709,6.491l-7.492-6.019l-0.631,0.184    l5.757,7.281l-11.407-3.812l-0.527,0.58L22.8,18.705L8.739,19.887l-0.157,0.868l14.612,1.601L10.999,32.504l0.527,0.708    l14.508-7.937l-2.864,13.984h0.868l5.569-13.168L33,36.392l0.603-0.473L32.212,25.46l5.28,6.019l0.341-0.555l-4.045-7.463    l5.649,2.103l0.053-0.631l-5.072-3.76L39.2,20.019z"></path>
  </svg>
);

const SuccessIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
  </svg>
);

const YandexMusicAuthSettings = () => {
  const [authStatus, setAuthStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [tooltipOpenedByClick, setTooltipOpenedByClick] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Закрытие тултипа при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setIsTooltipOpen(false);
        setTooltipOpenedByClick(false);
      }
    };

    if (isTooltipOpen && tooltipOpenedByClick) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTooltipOpen, tooltipOpenedByClick]);

  const checkAuthStatus = async () => {
    try {
      const data = await getYandexMusicAuthStatus();
      setAuthStatus(data);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({ authenticated: false, error: error.message });
    }
  };

  const handleLogin = async () => {
    if (!token.trim()) {
      return;
    }

    setLoginInProgress(true);
    try {
      const result = await loginYandexMusic(token.trim());
      if (result.success) {
        setToken('');
        setShowTokenInput(false);
        await checkAuthStatus();
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoginInProgress(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logoutYandexMusic();
      await checkAuthStatus();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAuthStatus = () => {
    if (!authStatus) {
      return (
        <div className="auth-status loading">
          <InfoIcon />
          <span>Проверка статуса...</span>
        </div>
      );
    }

    if (authStatus.authenticated) {
      return (
        <div className="auth-status authenticated">
          <SuccessIcon />
          <span>
            Подключено {authStatus.account ? `(${authStatus.account.display_name || authStatus.account.login})` : ''}
          </span>
        </div>
      );
    }

    return (
      <div className="auth-status not-authenticated">
        <WarningIcon />
        <span>Не подключено</span>
        {authStatus.message && <div className="status-message">{authStatus.message}</div>}
      </div>
    );
  };

  return (
    <div className="soundcloud-auth-settings">
      <div className="settings-item">
        <span>Статус подключения</span>
        <div className={`auth-status ${authStatus?.authenticated ? 'authorized' : 'unauthorized'}`}>
          {authStatus?.authenticated ? 
            `Подключено ${authStatus.account ? `(${authStatus.account.display_name || authStatus.account.login})` : ''}` : 
            'Не подключено'
          }
        </div>
      </div>

      {!authStatus?.authenticated ? (
        <div className="sc-input-container">
          <input
            type="password"
            className="sc-client-id-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Введите токен Яндекс.Музыки"
            disabled={loginInProgress}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          <div
            className="sc-help-button"
            onMouseEnter={() => {
              if (!tooltipOpenedByClick) {
                setIsTooltipOpen(true);
              }
            }}
            onMouseLeave={() => {
              if (!tooltipOpenedByClick) {
                setIsTooltipOpen(false);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              const newState = !isTooltipOpen;
              setIsTooltipOpen(newState);
              setTooltipOpenedByClick(newState);
            }}
            ref={tooltipRef}
          >
            ?
          </div>

          {isTooltipOpen && (
            <div className="sc-tooltip">
              <h4>Как получить токен Яндекс.Музыки:</h4>
              <ol>
                <li>Откройте <a href="https://github.com/MarshalX/yandex-music-token" target="_blank" rel="noopener noreferrer">yandex-music-token</a></li>
                <li>Установите зависимости: <code>pip install yandex-music-token</code></li>
                <li>Запустите команду: <code>python -m yandex_music_token</code></li>
                <li>Следуйте инструкциям в консоли для авторизации</li>
                <li>Скопируйте полученный токен</li>
              </ol>
              <p><strong>Внимание:</strong> Токен дает полный доступ к вашему аккаунту Яндекс.Музыки</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="soundcloud-auth-actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
        {!authStatus?.authenticated ? (
          <button
            className="cache-clear-button"
            onClick={handleLogin}
            disabled={!token.trim() || loginInProgress}
            style={{ background: 'var(--accent-color)' }}
          >
            {loginInProgress ? 'Подключение...' : 'Подключиться'}
          </button>
        ) : (
          <button
            className={`cache-clear-button destructive ${isLoading ? 'disabled' : ''}`}
            onClick={handleLogout}
            disabled={isLoading}
          >
            {isLoading ? 'Отключение...' : 'Отключиться'}
          </button>
        )}
      </div>
    </div>
  );
};

export default YandexMusicAuthSettings;