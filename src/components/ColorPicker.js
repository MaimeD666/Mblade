// src/components/ColorPicker.js
import React, { useState, useEffect } from "react";
import "./ColorPicker.css";

// Предустановленные цвета
const PRESET_COLORS = [
    "#c83ad8", // Фиолетовый (по умолчанию)
    "#8c43ff", // Индиго
    "#4361ee", // Синий
    "#4cc9f0", // Голубой
    "#06d6a0", // Мятный
    "#79c6b0", // Светло-мятный
    "#ffd166", // Желтый
    "#ff9f1c", // Оранжевый
    "#ff5c8a", // Розовый
    "#ef476f", // Красный
];

const ColorPicker = ({ color, onChange, label = "Выберите цвет" }) => {
    const [currentColor, setCurrentColor] = useState(color || PRESET_COLORS[0]);
    const [isOpen, setIsOpen] = useState(false);
    const [recentColors, setRecentColors] = useState([]);
    const [inputValue, setInputValue] = useState(color || PRESET_COLORS[0]);

    useEffect(() => {
        // Загрузка недавно использованных цветов из localStorage
        try {
            const savedColors = localStorage.getItem("recentColors");
            if (savedColors) {
                setRecentColors(JSON.parse(savedColors));
            }
        } catch (error) {
            console.error("Ошибка при загрузке недавних цветов:", error);
        }
    }, []);

    useEffect(() => {
        setCurrentColor(color);
        setInputValue(color);
    }, [color]);

    const toggleColorPicker = () => {
        setIsOpen(!isOpen);
    };

    const handleColorChange = (newColor) => {
        // Немедленно обновляем состояние и вызываем onChange
        setCurrentColor(newColor);
        setInputValue(newColor);
        // Вызываем onChange сразу, чтобы тема обновилась мгновенно
        onChange(newColor);
        addToRecentColors(newColor);
        
        // Принудительно обновляем preview
        const preview = document.querySelector('.color-preview');
        if (preview) {
            preview.style.backgroundColor = newColor;
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);

        // Проверяем, является ли введенное значение корректным HEX-цветом
        if (/^#[0-9A-F]{6}$/i.test(value)) {
            setCurrentColor(value);
            // Вызываем onChange сразу для мгновенного применения
            onChange(value);
            addToRecentColors(value);
            
            // Принудительно обновляем preview
            const preview = document.querySelector('.color-preview');
            if (preview) {
                preview.style.backgroundColor = value;
            }
        }
    };

    const addToRecentColors = (newColor) => {
        if (!recentColors.includes(newColor)) {
            const updatedColors = [newColor, ...recentColors.slice(0, 4)];
            setRecentColors(updatedColors);

            try {
                localStorage.setItem("recentColors", JSON.stringify(updatedColors));
            } catch (error) {
                console.error("Ошибка при сохранении недавних цветов:", error);
            }
        }
    };


    return (
        <div className="color-picker-container">
            <div className="color-picker-label-row">
                <div className="color-picker-label">{label}</div>
                <div
                    className="color-preview"
                    onClick={toggleColorPicker}
                    style={{ backgroundColor: currentColor }}
                    ref={(ref) => {
                        if (ref && currentColor) {
                            ref.style.backgroundColor = currentColor;
                        }
                    }}
                >
                    <span className="color-value">{currentColor}</span>
                </div>
            </div>

            {isOpen && (
                <div className="color-picker-popup">
                    <div className="color-input-row">
                        <input
                            type="color"
                            className="color-input"
                            value={currentColor}
                            onChange={(e) => handleColorChange(e.target.value)}
                        />
                        <input
                            type="text"
                            className="color-text-input"
                            value={inputValue}
                            onChange={handleInputChange}
                            placeholder="#RRGGBB"
                        />
                    </div>

                    {recentColors.length > 0 && (
                        <div className="recent-colors-section">
                            <div className="recent-colors-label">Недавно использованные</div>
                            <div className="recent-colors">
                                {recentColors.map((recentColor, index) => (
                                    <div
                                        key={`recent-${index}`}
                                        className={`recent-color ${recentColor === currentColor ? "active" : ""}`}
                                        style={{ backgroundColor: recentColor }}
                                        onClick={() => handleColorChange(recentColor)}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="preset-colors-section">
                        <div className="preset-colors-label">Предустановленные цвета</div>
                        <div className="preset-colors">
                            {PRESET_COLORS.map((presetColor, index) => (
                                <div
                                    key={`preset-${index}`}
                                    className={`preset-color ${presetColor === currentColor ? "active" : ""}`}
                                    style={{ backgroundColor: presetColor }}
                                    onClick={() => handleColorChange(presetColor)}
                                ></div>
                            ))}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default ColorPicker;