import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../services/api';
import { getYandexMusicAuthStatus, loginYandexMusic, logoutYandexMusic } from '../services/api';

const YouTubeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="currentColor"/>
  </svg>
);

const SoundCloudIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.03-1 .122v5.689c.446.143.636.138 1 .138v-5.949z" fill="currentColor" />
  </svg>
);

const YandexMusicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const AuthenticationPanel = () => {
  // YouTube состояния
  const [youtubeAuthStatus, setYoutubeAuthStatus] = useState(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  
  // SoundCloud состояния
  const [soundcloudAuthStatus, setSoundcloudAuthStatus] = useState(null);
  const [soundcloudLoading, setSoundcloudLoading] = useState(false);
  const [soundcloudClientId, setSoundcloudClientId] = useState('');
  const [soundcloudTooltipOpen, setSoundcloudTooltipOpen] = useState(false);
  const soundcloudTooltipRef = useRef(null);
  
  // Yandex Music состояния
  const [yandexAuthStatus, setYandexAuthStatus] = useState(null);
  const [yandexLoading, setYandexLoading] = useState(false);
  const [yandexToken, setYandexToken] = useState('');
  const [yandexTooltipOpen, setYandexTooltipOpen] = useState(false);
  const yandexTooltipRef = useRef(null);

  useEffect(() => {
    checkAllAuthStatuses();
  }, []);

  // Закрытие тултипов при клике вне их
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (soundcloudTooltipRef.current && !soundcloudTooltipRef.current.contains(event.target)) {
        setSoundcloudTooltipOpen(false);
      }
      if (yandexTooltipRef.current && !yandexTooltipRef.current.contains(event.target)) {
        setYandexTooltipOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkAllAuthStatuses = async () => {
    await Promise.all([
      checkYouTubeAuthStatus(),
      checkSoundCloudAuthStatus(),
      checkYandexAuthStatus()
    ]);
  };

  // YouTube методы
  const checkYouTubeAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/auth-status`);
      const data = await response.json();
      setYoutubeAuthStatus(data);
    } catch (error) {
      console.error('Error checking YouTube auth status:', error);
      setYoutubeAuthStatus({ authenticated: false, error: error.message });
    }
  };

  const handleYouTubeLogin = async () => {
    setYoutubeLoading(true);
    try {
      const authWindow = window.open(
        `${API_BASE_URL}/youtube/auth-redirect`,
        'YouTubeAuth',
        'width=800,height=600,scrollbars=yes'
      );

      if (!authWindow) {
        throw new Error('Не удалось открыть окно авторизации');
      }

      // Периодически проверяем статус авторизации
      const pollAuthStatus = async () => {
        let attempts = 0;
        const maxAttempts = 120; // 10 минут (120 * 5 секунд)
        
        const checkStatus = async () => {
          try {
            // Получаем свежий статус авторизации
            const response = await fetch(`${API_BASE_URL}/youtube/auth-status`);
            const authData = await response.json();
            setYoutubeAuthStatus(authData);
            
            attempts++;
            
            // Если авторизовались успешно
            if (authData?.authenticated) {
              console.log('[YouTube Auth] Авторизация успешно завершена!');
              setYoutubeLoading(false);
              return;
            }
            
            // Если превысили максимальное количество попыток
            if (attempts >= maxAttempts) {
              console.log('[YouTube Auth] Превышено максимальное время ожидания');
              setYoutubeLoading(false);
              return;
            }
            
            // Если окно закрыто пользователем
            if (authWindow.closed) {
              console.log('[YouTube Auth] Окно авторизации было закрыто пользователем');
              setYoutubeLoading(false);
              return;
            }
            
            // Продолжаем проверку через 5 секунд
            setTimeout(checkStatus, 5000);
          } catch (error) {
            console.error('Error polling YouTube auth status:', error);
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 5000);
            } else {
              setYoutubeLoading(false);
            }
          }
        };
        
        // Начинаем проверку через 3 секунды
        setTimeout(checkStatus, 3000);
      };
      
      pollAuthStatus();
      
    } catch (error) {
      console.error('YouTube login error:', error);
      setYoutubeLoading(false);
    }
  };

  const handleYouTubeLogout = async () => {
    setYoutubeLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/logout`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        await checkYouTubeAuthStatus();
      }
    } catch (error) {
      console.error('YouTube logout error:', error);
    } finally {
      setYoutubeLoading(false);
    }
  };

  // SoundCloud методы
  const checkSoundCloudAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/soundcloud/check-auth`);
      const data = await response.json();
      setSoundcloudAuthStatus(data);
    } catch (error) {
      console.error('Error checking SoundCloud auth status:', error);
      setSoundcloudAuthStatus({ is_authorized: false, error: error.message });
    }
  };

  const handleSoundCloudSubmit = async () => {
    if (!soundcloudClientId.trim()) return;
    
    setSoundcloudLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/soundcloud/set-client-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: soundcloudClientId.trim() })
      });
      
      if (response.ok) {
        setSoundcloudClientId('');
        await checkSoundCloudAuthStatus();
      }
    } catch (error) {
      console.error('SoundCloud client ID error:', error);
    } finally {
      setSoundcloudLoading(false);
    }
  };

  const handleSoundCloudReset = async () => {
    setSoundcloudLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/soundcloud/reset-auth`, { method: 'POST' });
      if (response.ok) {
        await checkSoundCloudAuthStatus();
      }
    } catch (error) {
      console.error('SoundCloud reset error:', error);
    } finally {
      setSoundcloudLoading(false);
    }
  };

  // Yandex Music методы
  const checkYandexAuthStatus = async () => {
    try {
      const data = await getYandexMusicAuthStatus();
      setYandexAuthStatus(data);
    } catch (error) {
      console.error('Error checking Yandex auth status:', error);
      setYandexAuthStatus({ authenticated: false, error: error.message });
    }
  };

  const handleYandexSubmit = async () => {
    if (!yandexToken.trim()) return;
    
    setYandexLoading(true);
    try {
      const result = await loginYandexMusic(yandexToken.trim());
      if (result.success) {
        setYandexToken('');
        await checkYandexAuthStatus();
      }
    } catch (error) {
      console.error('Yandex login error:', error);
    } finally {
      setYandexLoading(false);
    }
  };

  const handleYandexLogout = async () => {
    setYandexLoading(true);
    try {
      await logoutYandexMusic();
      await checkYandexAuthStatus();
    } catch (error) {
      console.error('Yandex logout error:', error);
    } finally {
      setYandexLoading(false);
    }
  };

  const renderServiceAuth = (service, icon, status, loading) => {
    const isAuthenticated = service === 'youtube' 
      ? status?.authenticated 
      : service === 'soundcloud' 
        ? status?.is_authorized 
        : status?.authenticated;

    return (
      <div className="service-auth-item">
        <div className="service-header">
          {icon}
          <div className="service-info">
            <div className="service-name">
              {service === 'youtube' ? 'YouTube' : service === 'soundcloud' ? 'SoundCloud' : 'Яндекс.Музыка'}
            </div>
            <div className={`service-status ${isAuthenticated ? 'connected' : 'disconnected'}`}>
              {isAuthenticated ? (
                <>
                  <SuccessIcon />
                  <span>
                    Подключено
                    {service === 'youtube' && status?.email ? ` (${status.email})` : ''}
                    {service === 'yandex_music' && status?.account ? 
                      ` (${status.account.display_name || status.account.login})` : ''}
                  </span>
                </>
              ) : (
                <>
                  <WarningIcon />
                  <span>Не подключено</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="service-actions">
          {!isAuthenticated ? (
            <>
              {service === 'youtube' ? (
                <button
                  className="auth-button primary"
                  onClick={handleYouTubeLogin}
                  disabled={loading}
                >
                  {loading ? 'Подключение...' : 'Подключиться'}
                </button>
              ) : (
                <div className="input-with-help">
                  <div className="input-container" ref={service === 'soundcloud' ? soundcloudTooltipRef : yandexTooltipRef}>
                    <input
                      type={service === 'yandex_music' ? 'password' : 'text'}
                      className="auth-input"
                      placeholder={service === 'soundcloud' ? 'Client ID' : 'Токен Яндекс.Музыки'}
                      value={service === 'soundcloud' ? soundcloudClientId : yandexToken}
                      onChange={(e) => service === 'soundcloud' 
                        ? setSoundcloudClientId(e.target.value) 
                        : setYandexToken(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && 
                        (service === 'soundcloud' ? handleSoundCloudSubmit() : handleYandexSubmit())}
                      disabled={loading}
                    />
                    <button
                      className="help-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (service === 'soundcloud') {
                          setSoundcloudTooltipOpen(!soundcloudTooltipOpen);
                        } else {
                          setYandexTooltipOpen(!yandexTooltipOpen);
                        }
                      }}
                    >
                      Как?
                    </button>

                    {((service === 'soundcloud' && soundcloudTooltipOpen) || 
                      (service === 'yandex_music' && yandexTooltipOpen)) && (
                      <div className="help-tooltip">
                        {service === 'soundcloud' ? (
                          <div>
                            <h4>Как получить SoundCloud Client ID:</h4>
                            <ol>
                              <li>Откройте <a href="https://soundcloud.com" target="_blank" rel="noopener noreferrer">SoundCloud.com</a></li>
                              <li>Войдите в свой аккаунт SoundCloud</li>
                              <li>Нажмите <strong>F12</strong> для открытия Инструментов разработчика</li>
                              <li>Перейдите на вкладку <strong>Network</strong> (Сеть)</li>
                              <li>В строке поиска введите <code>client_id</code></li>
                              <li>Обновите страницу (F5) или просмотрите любой трек</li>
                              <li>Найдите в списке запрос к API SoundCloud</li>
                              <li>Скопируйте значение после <code>client_id=</code></li>
                            </ol>
                          </div>
                        ) : (
                          <div>
                            <h4>Как получить токен Яндекс.Музыки:</h4>
                            <ol>
                              <li>Установите <a href="https://chromewebstore.google.com/detail/yandex-music-token/lcbjeookjibfhjjopieifgjnhlegmkib" target="_blank" rel="noopener noreferrer">расширение для Chrome</a></li>
                              <li>Войдите в свой аккаунт Яндекс.Музыки</li>
                              <li>Нажмите на иконку расширения</li>
                              <li>Нажмите "Скопировать токен"</li>
                              <li>Вставьте скопированный токен сюда</li>
                            </ol>
                            <p><strong>Внимание:</strong> Токен дает полный доступ к вашему аккаунту</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="auth-button primary"
                    onClick={service === 'soundcloud' ? handleSoundCloudSubmit : handleYandexSubmit}
                    disabled={loading || !(service === 'soundcloud' ? soundcloudClientId.trim() : yandexToken.trim())}
                  >
                    {loading ? 'Подключение...' : 'Подключиться'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              className="auth-button secondary"
              onClick={service === 'youtube' ? handleYouTubeLogout : 
                      service === 'soundcloud' ? handleSoundCloudReset : handleYandexLogout}
              disabled={loading}
            >
              {loading ? 'Отключение...' : 'Отключиться'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="authentication-panel">
      <div className="auth-header">
        <h4>Аутентификация сервисов</h4>
        <p>Подключите музыкальные сервисы для поиска и воспроизведения треков</p>
      </div>

      <div className="services-list">
        {renderServiceAuth('youtube', <YouTubeIcon />, youtubeAuthStatus, youtubeLoading)}
        {renderServiceAuth('soundcloud', <SoundCloudIcon />, soundcloudAuthStatus, soundcloudLoading)}
        {renderServiceAuth('yandex_music', <YandexMusicIcon />, yandexAuthStatus, yandexLoading)}
      </div>
    </div>
  );
};

export default AuthenticationPanel;