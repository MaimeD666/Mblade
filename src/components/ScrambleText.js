import React, { useState } from 'react';
import useTextScramble from '../hooks/useTextScramble';

const ScrambleText = ({ 
  originalText, 
  targetText, 
  isHovered, 
  className = "",
  delay = 0 
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [currentTarget, setCurrentTarget] = useState(originalText);
  
  React.useEffect(() => {
    if (isHovered) {
      // Небольшая задержка перед началом анимации
      const timer = setTimeout(() => {
        setCurrentTarget(targetText);
        setShouldAnimate(true);
      }, delay);
      
      return () => clearTimeout(timer);
    } else {
      setCurrentTarget(originalText);
      setShouldAnimate(false);
    }
  }, [isHovered, originalText, targetText, delay]);

  const displayText = useTextScramble(currentTarget, shouldAnimate && isHovered);

  return <span className={className}>{displayText}</span>;
};

export default ScrambleText;