import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../services/api';

const SoundCloudSettings = () => {
    const [clientId, setClientId] = useState(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [resetInProgress, setResetInProgress] = useState(false);

    const checkAuth = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/soundcloud/check-auth`);
            const data = await response.json();

            console.log("SoundCloud auth check:", data);
            setIsAuthorized(data.is_authorized);
            setClientId(data.client_id_value);
        } catch (error) {
            console.error('Ошибка при проверке настроек SoundCloud:', error);
            setError('Не удалось получить данные авторизации');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const handleResetAuth = async () => {
        setResetInProgress(true);
        try {
            const response = await fetch(`${API_BASE_URL}/soundcloud/reset-auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                setIsAuthorized(false);
                setClientId(null);
                alert('Авторизация SoundCloud сброшена. Необходимо перезапустить приложение.');
            } else {
                setError('Ошибка сброса авторизации: ' + (data.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Ошибка при сбросе авторизации SoundCloud:', error);
            setError('Не удалось сбросить авторизацию');
        } finally {
            setResetInProgress(false);
        }
    };

    const handleOpenAuth = () => {
        const authWindow = window.open(
            `${API_BASE_URL}/soundcloud/auth-redirect`,
            'SoundCloudAuth',
            'width=800,height=600,scrollbars=yes'
        );

        if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
            setError('Не удалось открыть окно авторизации. Пожалуйста, разрешите всплывающие окна для этого сайта.');
        }

        // Проверяем авторизацию через 5 секунд после открытия окна
        setTimeout(() => {
            checkAuth();
        }, 5000);
    };

    // Скрываем часть client ID для безопасности
    const getMaskedClientId = () => {
        if (!clientId) return "Нет данных";
        if (clientId.length < 10) return "••••••••••";

        return clientId.substring(0, 4) + "••••••••••" + clientId.substring(clientId.length - 4);
    };

    return (
        <div className="settings-section">
            <h4>SoundCloud</h4>

            {loading ? (
                <div className="auth-loading" style={{ padding: '20px 0' }}>
                    <div className="spinner"></div>
                    <p>Проверка авторизации SoundCloud...</p>
                </div>
            ) : (
                <div className="soundcloud-auth-settings">
                    <div className="settings-item">
                        <span>Статус авторизации</span>
                        <div className={`auth-status ${isAuthorized ? 'authorized' : 'unauthorized'}`}>
                            {isAuthorized ? 'Авторизован' : 'Не авторизован'}
                        </div>
                    </div>

                    {clientId && (
                        <div className="settings-item">
                            <span>Client ID</span>
                            <div className="client-id-display">
                                {getMaskedClientId()}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="settings-error" style={{ color: 'var(--error-color)', marginBottom: '15px' }}>
                            {error}
                        </div>
                    )}

                    <div className="soundcloud-auth-actions" style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        {!isAuthorized ? (
                            <button
                                className="cache-clear-button"
                                onClick={handleOpenAuth}
                                style={{ background: 'var(--accent-color)' }}
                            >
                                Авторизоваться в SoundCloud
                            </button>
                        ) : (
                            <button
                                className={`cache-clear-button destructive ${resetInProgress ? 'disabled' : ''}`}
                                onClick={handleResetAuth}
                                disabled={resetInProgress}
                            >
                                {resetInProgress ? 'Сброс...' : 'Сбросить авторизацию'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SoundCloudSettings;