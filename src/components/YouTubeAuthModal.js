import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/api';

const YouTubeAuthModal = ({ isOpen, onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkAuthStatus();
    }
  }, [isOpen]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/auth-status`);
      const data = await response.json();
      setAuthStatus(data);
      
      if (data.authenticated) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({
        authenticated: false,
        selenium_available: false,
        error: error.message
      });
    }
  };

  const handleInteractiveLogin = async () => {
    setIsLoading(true);
    setError('');
    
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
        setError('Откроется окно браузера для входа в аккаунт YouTube. Дождитесь завершения авторизации.');
        
        const checkInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`${API_BASE_URL}/youtube/auth-status`);
            const statusData = await statusResponse.json();
            
            if (statusData.authenticated) {
              clearInterval(checkInterval);
              setIsLoading(false);
              onSuccess();
            }
          } catch (error) {
            console.error('Error checking auth status:', error);
          }
        }, 3000);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          if (isLoading) {
            setIsLoading(false);
            setError('Время ожидания авторизации истекло. Попробуйте еще раз.');
          }
        }, 300000);
        
      } else if (data.success) {
        setIsLoading(false);
        onSuccess();
      } else {
        setIsLoading(false);
        setError(data.message || data.error || 'Ошибка авторизации');
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Ошибка запроса: ${error.message}`);
    }
  };

  const handleCredentialsLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Введите email и пароль!');
      return;
    }

    setIsLoading(true);
    setError('');
    
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
        setIsLoading(false);
        onSuccess();
      } else {
        setIsLoading(false);
        setError(data.message || data.error || 'Ошибка авторизации');
      }
    } catch (error) {
      setIsLoading(false);
      setError(`Ошибка запроса: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: 'var(--secondary-bg)',
        borderRadius: '20px',
        width: 'min(500px, 90vw)',
        padding: '32px',
        color: 'var(--text-color)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
          </svg>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
            Авторизация YouTube
          </h2>
        </div>

        <p style={{ 
          fontSize: '16px', 
          lineHeight: '1.5', 
          marginBottom: '24px',
          color: 'var(--text-color-secondary)' 
        }}>
          Для полноценной работы приложения необходимо войти в аккаунт YouTube.
          Это обеспечит доступ к расширенным возможностям поиска и воспроизведения.
        </p>

        {authStatus && !authStatus.selenium_available && (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#f44336'
          }}>
            <strong>Selenium недоступен.</strong><br />
            Для авторизации установите: pip install selenium webdriver-manager
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            color: '#f44336'
          }}>
            {error}
          </div>
        )}

        {authStatus?.selenium_available && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <button
                onClick={handleInteractiveLogin}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: isLoading ? '#666' : 'var(--accent-color)',
                  color: 'var(--text-color)',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {isLoading ? 'Авторизация...' : 'Войти через браузер'}
              </button>

              <button
                onClick={() => setShowCredentials(!showCredentials)}
                disabled={isLoading}
                style={{
                  padding: '12px 20px',
                  backgroundColor: 'rgba(var(--text-color-rgb, 255, 255, 255), 0.1)',
                  color: 'var(--text-color)',
                  border: '1px solid rgba(var(--text-color-rgb, 255, 255, 255), 0.2)',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {showCredentials ? 'Скрыть' : 'Логин/пароль'}
              </button>
            </div>

            {showCredentials && (
              <div style={{
                padding: '20px',
                backgroundColor: 'rgba(var(--text-color-rgb, 255, 255, 255), 0.05)',
                borderRadius: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@gmail.com"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid rgba(var(--text-color-rgb, 255, 255, 255), 0.1)',
                      backgroundColor: 'rgba(var(--text-color-rgb, 255, 255, 255), 0.05)',
                      color: 'var(--text-color)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Пароль от аккаунта Google"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid rgba(var(--text-color-rgb, 255, 255, 255), 0.1)',
                      backgroundColor: 'rgba(var(--text-color-rgb, 255, 255, 255), 0.05)',
                      color: 'var(--text-color)',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                
                <button
                  onClick={handleCredentialsLogin}
                  disabled={isLoading || !email.trim() || !password.trim()}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    backgroundColor: isLoading || !email.trim() || !password.trim() ? '#666' : 'var(--accent-color)',
                    color: 'var(--text-color)',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: isLoading || !email.trim() || !password.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isLoading ? 'Вход...' : 'Войти'}
                </button>

                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(255, 193, 7, 0.1)',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-color-secondary)'
                }}>
                  ⚠️ При включенной двухфакторной аутентификации используйте вход через браузер
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(var(--accent-color-rgb, 181, 58, 212), 0.1)',
          border: '1px solid rgba(var(--accent-color-rgb, 181, 58, 212), 0.2)',
          borderRadius: '12px',
          fontSize: '13px',
          color: 'var(--text-color-secondary)',
          lineHeight: '1.4'
        }}>
          <strong>Безопасность:</strong> Ваши данные для входа обрабатываются локально и не передаются третьим лицам.
          Авторизация сохраняется в файле cookies на вашем устройстве.
        </div>
      </div>
    </div>
  );
};

export default YouTubeAuthModal;