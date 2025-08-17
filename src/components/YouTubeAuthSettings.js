import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/api';

const YouTubeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="currentColor"/>
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

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z" fill="currentColor"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
  </svg>
);

const YouTubeAuthSettings = () => {
  const [authStatus, setAuthStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginInProgress, setLoginInProgress] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/auth-status`);
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({
        authenticated: false,
        error: error.message
      });
    }
  };

  const handleInteractiveLogin = async () => {
    setIsLoading(true);
    setLoginInProgress(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          headless: false,
          force_reauth: true
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.interactive) {
        alert('Откроется окно браузера для входа в аккаунт YouTube. Процесс автоматически завершится когда вы войдете в систему.');
      } else if (data.success) {
        alert('Авторизация прошла успешно!');
        await checkAuthStatus();
      } else {
        alert(`Ошибка авторизации: ${data.message || data.error}`);
      }
    } catch (error) {
      alert(`Ошибка запроса: ${error.message}`);
    } finally {
      setIsLoading(false);
      setLoginInProgress(false);
    }
  };

  const handleCredentialsLogin = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Введите email и пароль!');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          headless: true,
          force_reauth: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Авторизация прошла успешно!');
        setEmail('');
        setPassword('');
        setShowCredentials(false);
        await checkAuthStatus();
      } else {
        alert(`Ошибка авторизации: ${data.message || data.error}`);
      }
    } catch (error) {
      alert(`Ошибка запроса: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Вы уверены, что хотите выйти из аккаунта YouTube?')) {
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/logout`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Выход выполнен успешно!');
        await checkAuthStatus();
      } else {
        alert(`Ошибка выхода: ${data.error}`);
      }
    } catch (error) {
      alert(`Ошибка запроса: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!authStatus) return '#999';
    if (authStatus.authenticated) return '#4CAF50';
    if (authStatus.cookie_file_exists) return '#FF9800';
    return '#F44336';
  };

  const getStatusText = () => {
    if (!authStatus) return 'Проверка...';
    if (!authStatus.selenium_available) return 'Selenium недоступен';
    if (authStatus.authenticated) return 'Авторизован в YouTube';
    if (authStatus.cookie_file_exists) return 'Куки найдены, но недействительны';
    return 'Не авторизован';
  };

  const getStatusIcon = () => {
    if (!authStatus) return <InfoIcon />;
    if (authStatus.authenticated) return <SuccessIcon />;
    if (authStatus.cookie_file_exists) return <WarningIcon />;
    return <ErrorIcon />;
  };

  return (
    <>
      <div className="settings-item" style={{
        background: `linear-gradient(135deg, ${getStatusColor()}15, ${getStatusColor()}08)`,
        border: `1px solid ${getStatusColor()}30`,
        borderRadius: '12px',
        padding: '20px',
        margin: '16px 0',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '12px'
        }}>
          {getStatusIcon()}
          <div>
            <div className="settings-item-label" style={{ 
              fontSize: '16px', 
              fontWeight: '600',
              color: getStatusColor()
            }}>
              {getStatusText()}
            </div>
            <div className="settings-item-description">
              Статус авторизации в YouTube для улучшенного доступа к контенту
            </div>
          </div>
        </div>
        
        {authStatus && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            opacity: '0.8'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Selenium:</span>
              <span style={{ color: authStatus.selenium_available ? '#4CAF50' : '#F44336', fontWeight: '600' }}>
                {authStatus.selenium_available ? '✓ Доступен' : '✗ Недоступен'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Файл cookies:</span>
              <span style={{ color: authStatus.cookie_file_exists ? '#4CAF50' : '#999', fontWeight: '600' }}>
                {authStatus.cookie_file_exists ? '✓ Найден' : '✗ Отсутствует'}
              </span>
            </div>
            {authStatus.last_modified && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Обновлено:</span>
                <span style={{ fontWeight: '600' }}>
                  {new Date(authStatus.last_modified * 1000).toLocaleString()}
                </span>
              </div>
            )}
            {authStatus.file_size && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Размер:</span>
                <span style={{ fontWeight: '600' }}>{authStatus.file_size} байт</span>
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <button
            onClick={checkAuthStatus}
            disabled={isLoading}
            className="modern-button secondary"
          >
            {isLoading ? 'Проверка...' : 'Обновить статус'}
          </button>

          {authStatus?.selenium_available && !authStatus?.authenticated && (
            <>
              <button
                onClick={handleInteractiveLogin}
                disabled={isLoading || loginInProgress}
                className="modern-button"
              >
                {isLoading ? 'Авторизация...' : 'Войти в аккаунт'}
              </button>

              <button
                onClick={() => setShowCredentials(!showCredentials)}
                className="modern-button secondary"
              >
                {showCredentials ? 'Скрыть форму' : 'Логин/пароль'}
              </button>
            </>
          )}

          {authStatus?.authenticated && (
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="modern-button destructive"
            >
              {isLoading ? 'Выход...' : 'Выйти'}
            </button>
          )}
        </div>

        {!authStatus?.selenium_available && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            borderRadius: '8px',
            color: '#f44336',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ErrorIcon />
            <span>
              Selenium недоступен. Установите: <code style={{
                background: 'rgba(244, 67, 54, 0.2)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}>pip install selenium webdriver-manager</code>
            </span>
          </div>
        )}
      </div>

      {showCredentials && authStatus?.selenium_available && (
        <div style={{
          marginTop: '16px',
          padding: '20px',
          background: 'rgba(var(--text-color-rgb, 255, 255, 255), 0.03)',
          border: '1px solid rgba(var(--text-color-rgb, 255, 255, 255), 0.1)',
          borderRadius: '12px'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-color)'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@gmail.com"
              className="modern-input"
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-color)'
            }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль от аккаунта Google"
              className="modern-input"
            />
          </div>
          
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <button
              onClick={handleCredentialsLogin}
              disabled={isLoading || !email.trim() || !password.trim()}
              className="modern-button"
            >
              {isLoading ? 'Авторизация...' : 'Войти'}
            </button>
            
            <button
              onClick={() => {
                setEmail('');
                setPassword('');
                setShowCredentials(false);
              }}
              className="modern-button secondary"
            >
              Отмена
            </button>
          </div>
          
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-color-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <WarningIcon />
            <span>
              ⚠️ Если у вас включена двухфакторная аутентификация, используйте обычный вход через браузер
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default YouTubeAuthSettings;