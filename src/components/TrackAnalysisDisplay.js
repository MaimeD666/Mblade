import React from 'react';

const TrackAnalysisDisplay = ({ analysisData }) => {
    if (!analysisData) return null;

    const { genres, moods, instruments, languages, detected_tags } = analysisData;

    const renderTags = (tags, title, emoji, color) => {
        if (!tags || tags.length === 0) return null;
        
        return (
            <div style={{ marginBottom: '10px' }}>
                <div style={{ 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    color: '#666',
                    marginBottom: '4px'
                }}>
                    {emoji} {title}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {tags.slice(0, 3).map((tagObj, i) => (
                        <span
                            key={i}
                            style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                background: color || '#e0e0e0',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                            title={`Уверенность: ${(tagObj.confidence * 100).toFixed(0)}%`}
                        >
                            {tagObj.tag}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={{ 
            padding: '10px',
            fontSize: '12px',
            background: '#f8f9fa',
            borderRadius: '6px',
            marginTop: '8px'
        }}>
            <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '8px',
                color: '#0066cc'
            }}>
                🧠 ИИ Анализ
            </div>
            
            {renderTags(genres, 'Жанры', '🎵', '#6366f1')}
            {renderTags(moods, 'Настроения', '🎭', '#ef4444')}
            {renderTags(instruments, 'Инструменты', '🎼', '#10b981')}
            {renderTags(languages, 'Язык', '🌍', '#f59e0b')}
            
            {detected_tags && detected_tags.length > 0 && (
                <div style={{ 
                    marginTop: '8px', 
                    fontSize: '10px', 
                    color: '#888'
                }}>
                    Всего тегов: {detected_tags.length}
                </div>
            )}
        </div>
    );
};

export default TrackAnalysisDisplay;