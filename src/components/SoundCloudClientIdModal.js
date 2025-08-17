import React, { useState, useRef } from 'react';
import './SoundCloudClientIdModal.css';

const SoundCloudClientIdModal = ({ isOpen, onSubmit, onCancel }) => {
    const [clientId, setClientId] = useState('');
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);
    const tooltipRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!clientId.trim()) {
            setError('Введите Client ID');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit(clientId.trim());
        } catch (error) {
            setError(error.message || 'Ошибка при сохранении Client ID');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="sc-modal-overlay">
            <div className="sc-modal-content">
                <h3 className="sc-modal-title">SoundCloud Client ID</h3>

                <div className="sc-modal-description">
                    <p>
                        Для доступа к трекам SoundCloud требуется Client ID.
                        Пожалуйста, введите ваш собственный SoundCloud Client ID.
                    </p>
                </div>

                <div className="sc-input-container">
                    <input
                        type="text"
                        className="sc-client-id-input"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="Ваш SoundCloud Client ID"
                        disabled={isSubmitting}
                    />
                    <div
                        className="sc-help-button"
                        onMouseEnter={() => setIsTooltipOpen(true)}
                        onMouseLeave={() => setIsTooltipOpen(false)}
                        onClick={() => setIsTooltipOpen(!isTooltipOpen)}
                        ref={tooltipRef}
                    >
                        ?
                    </div>

                    {isTooltipOpen && (
                        <div className="sc-tooltip">
                            <h4>Как получить SoundCloud Client ID:</h4>
                            <ol>
                                <li>Откройте сайт <a href="https://soundcloud.com" target="_blank" rel="noopener noreferrer">SoundCloud.com</a></li>
                                <li>Войдите в свой аккаунт SoundCloud</li>
                                <li>Нажмите <strong>F12</strong> чтобы открыть Инструменты разработчика</li>
                                <li>Перейдите на вкладку <strong>Network</strong> (Сеть)</li>
                                <li>В строке поиска введите <code>client_id</code></li>
                                <li>Обновите страницу (F5) или просмотрите любой трек</li>
                                <li>Найдите в списке запрос к API SoundCloud (например, <code>tracks</code>)</li>
                                <li>В URL запроса найдите параметр <code>client_id=XXXXXXX</code></li>
                                <li>Скопируйте значение после <code>client_id=</code> и до следующего символа <code>&</code></li>
                            </ol>
                            <p><strong>Пример Client ID:</strong> <code>iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX</code></p>
                        </div>
                    )}
                </div>

                {error && <div className="sc-error-message">{error}</div>}

                <div className="sc-modal-buttons">
                    <button
                        className="sc-modal-button sc-modal-button-cancel"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Отмена
                    </button>
                    <button
                        className="sc-modal-button sc-modal-button-confirm"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SoundCloudClientIdModal;