import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/api';

const AIProfilePanel = () => {
    const [aiStatus, setAiStatus] = useState(null);
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        checkAIStatus();
        fetchAnalysisStatus();
        fetchProfileData();

        const interval = setInterval(() => {
            if (analysisStatus?.active) {
                fetchAnalysisStatus();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [analysisStatus?.active]);

    const checkAIStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/status`);
            const data = await response.json();
            setAiStatus(data);
        } catch (error) {
            console.error('Error checking AI status:', error);
        }
    };

    const fetchAnalysisStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/analysis/status`);
            const data = await response.json();
            setAnalysisStatus(data);
        } catch (error) {
            console.error('Error fetching analysis status:', error);
        }
    };

    const fetchProfileData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/profile`);
            const data = await response.json();
            setProfileData(data);
        } catch (error) {
            console.error('Error fetching profile data:', error);
        }
    };

    const startAnalysis = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/ai/analysis/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Analysis started:', data);
                fetchAnalysisStatus();
            } else {
                const error = await response.json();
                alert(`Ошибка: ${error.error}`);
            }
        } catch (error) {
            console.error('Error starting analysis:', error);
            alert('Ошибка подключения к серверу');
        }
        setIsLoading(false);
    };

    const stopAnalysis = async () => {
        try {
            await fetch(`${API_BASE_URL}/ai/analysis/stop`, {
                method: 'POST'
            });
            fetchAnalysisStatus();
        } catch (error) {
            console.error('Error stopping analysis:', error);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return 'Никогда';
        return new Date(timestamp * 1000).toLocaleString('ru-RU');
    };

    const formatDuration = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}ч ${minutes}мин`;
        }
        return `${minutes}мин`;
    };

    const getProfileStrengthColor = (strength) => {
        if (strength < 30) return '#ff4444';
        if (strength < 70) return '#ffaa00';
        return '#00aa44';
    };

    const getProfileStrengthText = (strength) => {
        if (strength < 30) return 'Слабый';
        if (strength < 70) return 'Средний';
        return 'Сильный';
    };

    if (!aiStatus) {
        return <div style={{ padding: '20px' }}>Загрузка...</div>;
    }

    if (!aiStatus.ml_available) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h3>🧠 ИИ Анализ недоступен</h3>
                <p>Для работы требуются библиотеки машинного обучения.</p>
                <p><strong>Установите:</strong></p>
                <code style={{ 
                    display: 'block', 
                    padding: '10px', 
                    background: '#f0f0f0', 
                    borderRadius: '5px',
                    margin: '10px 0'
                }}>
                    pip install openl3 librosa tensorflow
                </code>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🧠 Музыкальный Профиль ИИ
                <div style={{ 
                    fontSize: '12px', 
                    padding: '4px 8px', 
                    background: aiStatus.ml_available ? '#00aa44' : '#ff4444',
                    color: 'white',
                    borderRadius: '10px'
                }}>
                    {aiStatus.ml_available ? 'Доступен' : 'Недоступен'}
                </div>
            </h3>

            {profileData && (
                <div style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    border: '1px solid #ddd', 
                    borderRadius: '8px',
                    background: '#f9f9f9'
                }}>
                    <h4>📊 Статистика профиля</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                        <div>
                            <strong>Проанализировано треков:</strong><br/>
                            <span style={{ fontSize: '18px', color: '#0066cc' }}>
                                {profileData.tracks_analyzed}
                            </span>
                        </div>
                        <div>
                            <strong>Сила профиля:</strong><br/>
                            <span style={{ 
                                fontSize: '18px', 
                                color: getProfileStrengthColor(profileData.stats.profile_strength)
                            }}>
                                {profileData.stats.profile_strength.toFixed(0)}% 
                                ({getProfileStrengthText(profileData.stats.profile_strength)})
                            </span>
                        </div>
                        <div>
                            <strong>Сессий анализа:</strong><br/>
                            <span style={{ fontSize: '16px' }}>{profileData.stats.analysis_sessions}</span>
                        </div>
                        <div>
                            <strong>Последний анализ:</strong><br/>
                            <span style={{ fontSize: '14px', color: '#666' }}>
                                {formatTime(profileData.stats.last_analysis)}
                            </span>
                        </div>
                    </div>
                    
                    {profileData.profile.top_genres && (
                        <div style={{ marginTop: '15px' }}>
                            <h5>🎵 Ваши предпочтения</h5>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                                <div><strong>Жанры:</strong> {Object.keys(profileData.profile.top_genres).slice(0, 3).join(', ')}</div>
                                <div><strong>Настроения:</strong> {Object.keys(profileData.profile.top_moods || {}).slice(0, 3).join(', ')}</div>
                                {profileData.profile.languages && Object.keys(profileData.profile.languages).length > 0 && (
                                    <div><strong>Языки:</strong> {Object.keys(profileData.profile.languages).slice(0, 2).join(', ')}</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {analysisStatus?.active ? (
                <div style={{ 
                    padding: '15px', 
                    border: '2px solid #0066cc', 
                    borderRadius: '8px',
                    background: '#f0f8ff',
                    marginBottom: '20px'
                }}>
                    <h4 style={{ color: '#0066cc', marginBottom: '10px' }}>
                        🔍 Анализ в процессе...
                    </h4>
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{
                            width: '100%',
                            height: '8px',
                            background: '#e0e0e0',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${analysisStatus.progress}%`,
                                height: '100%',
                                background: '#0066cc',
                                transition: 'width 0.3s ease'
                            }}></div>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '14px',
                            marginTop: '5px'
                        }}>
                            <span>{analysisStatus.progress}%</span>
                            <span>{analysisStatus.total_tracks} треков</span>
                        </div>
                    </div>
                    
                    {analysisStatus.current_track && (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                            Сейчас: {analysisStatus.current_track}
                        </div>
                    )}

                    {analysisStatus.errors && analysisStatus.errors.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                            <details>
                                <summary style={{ cursor: 'pointer', color: '#cc6600' }}>
                                    Ошибки ({analysisStatus.errors.length})
                                </summary>
                                <div style={{ 
                                    marginTop: '5px', 
                                    fontSize: '12px', 
                                    maxHeight: '100px',
                                    overflow: 'auto',
                                    background: '#fff',
                                    padding: '5px',
                                    border: '1px solid #ddd'
                                }}>
                                    {analysisStatus.errors.map((error, i) => (
                                        <div key={i}>{error}</div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}

                    <button 
                        onClick={stopAnalysis}
                        style={{
                            padding: '8px 16px',
                            background: '#cc4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Остановить анализ
                    </button>
                </div>
            ) : (
                <div style={{ marginBottom: '20px' }}>
                    <button 
                        onClick={startAnalysis}
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '15px',
                            background: isLoading ? '#ccc' : '#0066cc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {isLoading ? '⏳ Запуск...' : '🚀 Создать музыкальный профиль'}
                    </button>
                    
                    <div style={{ 
                        fontSize: '14px', 
                        color: '#666', 
                        textAlign: 'center',
                        marginTop: '10px'
                    }}>
                        CLAP нейросеть определит жанры, настроения и инструменты в ваших треках
                    </div>
                </div>
            )}

            <div style={{ 
                padding: '15px', 
                background: '#f5f5f5', 
                borderRadius: '8px',
                fontSize: '14px',
                color: '#666'
            }}>
                <h5 style={{ marginTop: 0 }}>ℹ️ Как это работает:</h5>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                    <li>CLAP анализирует первые 30 секунд каждого трека</li>
                    <li>Определяет жанры, поджанры, настроения и инструменты</li>
                    <li>Создает ваш профиль предпочтений из понятных тегов</li>
                    <li>Все данные остаются на вашем компьютере</li>
                </ul>
            </div>
        </div>
    );
};

export default AIProfilePanel;