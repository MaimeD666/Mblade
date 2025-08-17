import React, { useState, useCallback } from 'react';
import './NotificationSystem.css';

let notificationManager = null;

const NotificationSystem = () => {
    const [notifications, setNotifications] = useState([]);
    const [expandedNotification, setExpandedNotification] = useState(null);

    const addNotification = useCallback((notification) => {
        const id = Date.now() + Math.random();
        const newNotification = {
            id,
            type: 'error',
            title: 'Ошибка',
            message: 'Произошла неизвестная ошибка',
            autoRemove: true,
            duration: 5000,
            ...notification
        };

        setNotifications(prev => [...prev, newNotification]);

        if (newNotification.autoRemove) {
            setTimeout(() => {
                removeNotification(id);
            }, newNotification.duration);
        }

        return id;
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, []);

    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const showError = useCallback((title, message, details, error = null) => {
        return addNotification({
            type: 'error',
            title,
            message,
            details,
            stack: error?.stack,
            duration: 8000
        });
    }, [addNotification]);

    const showWarning = useCallback((title, message, details) => {
        return addNotification({
            type: 'warning',
            title,
            message,
            details,
            duration: 6000
        });
    }, [addNotification]);

    const showInfo = useCallback((title, message, details) => {
        return addNotification({
            type: 'info',
            title,
            message,
            details,
            duration: 4000
        });
    }, [addNotification]);

    const showSuccess = useCallback((title, message, details) => {
        return addNotification({
            type: 'success',
            title,
            message,
            details,
            duration: 3000
        });
    }, [addNotification]);

    const handleApiError = useCallback((error, context = 'API') => {
        console.error(`[${context}] Error:`, error);

        let title = 'Ошибка сети';
        let message = 'Не удалось выполнить запрос';
        let details = '';

        if (error?.response) {
            const status = error.response.status;
            const statusText = error.response.statusText;

            switch (status) {
                case 404:
                    title = 'Не найдено';
                    message = 'Запрашиваемый ресурс не найден';
                    break;
                case 500:
                    title = 'Ошибка сервера';
                    message = 'Внутренняя ошибка сервера';
                    break;
                case 503:
                    title = 'Сервис недоступен';
                    message = 'Сервер временно недоступен';
                    break;
                case 429:
                    title = 'Слишком много запросов';
                    message = 'Превышен лимит запросов, попробуйте позже';
                    break;
                case 401:
                    title = 'Не авторизован';
                    message = 'Требуется авторизация';
                    break;
                case 403:
                    title = 'Доступ запрещен';
                    message = 'Недостаточно прав для выполнения операции';
                    break;
                default:
                    title = `Ошибка ${status}`;
                    message = statusText || 'Неизвестная ошибка сервера';
            }

            details = `${context}: ${status} ${statusText}`;
            if (error.response.data?.error) {
                details += `\nДетали: ${error.response.data.error}`;
            }
        } else if (error?.request) {
            title = 'Ошибка подключения';
            message = 'Не удалось подключиться к серверу';
            details = `${context}: Нет ответа от сервера`;
        } else {
            title = 'Ошибка';
            message = error?.message || 'Произошла неизвестная ошибка';
            details = `${context}: ${error?.message || 'Unknown error'}`;
        }

        return showError(title, message, details, error);
    }, [showError]);

    const handlePlaybackError = useCallback((track, error) => {
        let title = 'Ошибка воспроизведения';
        let message = `Не удалось воспроизвести "${track?.title || 'неизвестный трек'}"`;
        let details = '';

        if (error?.code) {
            switch (error.code) {
                case 1:
                    title = 'Воспроизведение прервано';
                    message = 'Воспроизведение было остановлено';
                    break;
                case 2:
                    title = 'Ошибка сети';
                    message = 'Ошибка загрузки аудио';
                    break;
                case 3:
                    title = 'Ошибка декодирования';
                    message = 'Не удалось декодировать аудиофайл';
                    break;
                case 4:
                    title = 'Формат не поддерживается';
                    message = 'Формат аудиофайла не поддерживается';
                    break;
            }
        }

        details = `Трек: ${track?.title || 'Unknown'} (${track?.platform || 'Unknown'})`;
        if (track?.id) {
            details += `\nID: ${track.id}`;
        }
        if (error?.message) {
            details += `\nОшибка: ${error.message}`;
        }

        return showError(title, message, details, error);
    }, [showError]);

    React.useEffect(() => {
        notificationManager = {
            showError,
            showWarning,
            showInfo,
            showSuccess,
            handleApiError,
            handlePlaybackError,
            addNotification,
            removeNotification,
            clearAllNotifications
        };
    }, [showError, showWarning, showInfo, showSuccess, handleApiError, handlePlaybackError, addNotification, removeNotification, clearAllNotifications]);

    const getIcon = (type) => {
        switch (type) {
            case 'error':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                    </svg>
                );
            case 'info':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                );
            case 'success':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                );
            default:
                return null;
        }
    };

    const handleNotificationClick = (notificationId) => {
        setExpandedNotification(expandedNotification === notificationId ? null : notificationId);
    };

    const handleClose = (e, notificationId) => {
        e.stopPropagation();
        removeNotification(notificationId);
        if (expandedNotification === notificationId) {
            setExpandedNotification(null);
        }
    };

    if (notifications.length === 0) return null;

    return (
        <div className="notification-container">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`notification notification-${notification.type} ${expandedNotification === notification.id ? 'expanded' : ''
                        }`}
                    onClick={() => handleNotificationClick(notification.id)}
                >
                    <div className="notification-header">
                        <div className="notification-icon">
                            {getIcon(notification.type)}
                        </div>
                        <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                        </div>
                        <button
                            className="notification-close"
                            onClick={(e) => handleClose(e, notification.id)}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                        </button>
                    </div>

                    {expandedNotification === notification.id && notification.details && (
                        <div className="notification-details">
                            <div className="notification-details-header">Подробности:</div>
                            <div className="notification-details-content">
                                {notification.details}
                            </div>
                            {notification.stack && (
                                <>
                                    <div className="notification-details-header">Stack Trace:</div>
                                    <pre className="notification-stack">{notification.stack}</pre>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export const getNotificationManager = () => notificationManager;

export default NotificationSystem;