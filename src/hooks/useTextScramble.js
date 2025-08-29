import { useState, useEffect, useRef } from 'react';

const useTextScramble = (targetText, isActive = false) => {
  const [displayText, setDisplayText] = useState(targetText);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const frameRef = useRef(0);
  
  // Символы для рандомной генерации
  const chars = 'абвгдежзийклмнопрстуфхцчшщъыьэюя1234567890!@#$%^&*()';
  
  useEffect(() => {
    if (!isActive) {
      setDisplayText(targetText);
      return;
    }

    let frame = 0;
    const resolve = () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
      setDisplayText(targetText);
    };

    const scramble = () => {
      let output = '';
      
      for (let i = 0; i < targetText.length; i++) {
        if (frame >= i * 3) {
          // Символ уже "дошел" до своего места
          output += targetText[i];
        } else {
          // Еще скремблим
          output += chars[Math.floor(Math.random() * chars.length)];
        }
      }
      
      setDisplayText(output);
      
      if (frame >= targetText.length * 3) {
        resolve();
      } else {
        frame++;
      }
    };

    // Запускаем анимацию
    intervalRef.current = setInterval(scramble, 50);
    
    // Принудительно завершаем через разумное время
    timeoutRef.current = setTimeout(resolve, targetText.length * 150 + 500);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [targetText, isActive]);

  return displayText;
};

export default useTextScramble;