"""
ChromeDriver Manager для автоматической настройки ChromeDriver при старте приложения
"""

import os
import sys
import threading
from setup_chromedriver import setup_chromedriver, get_chrome_version, is_chromedriver_compatible

class ChromeDriverManager:
    def __init__(self):
        self.chromedriver_path = None
        self.setup_complete = False
        self.setup_error = None
    
    def ensure_chromedriver_ready(self, timeout=60):
        """
        Обеспечивает готовность ChromeDriver к использованию
        Возвращает путь к ChromeDriver или None при ошибке
        """
        if self.setup_complete and self.chromedriver_path:
            return self.chromedriver_path
        
        print("[ChromeDriverManager] Checking ChromeDriver availability...")
        
        # Проверяем текущее состояние
        script_dir = os.path.dirname(os.path.abspath(__file__))
        chromedriver_path = os.path.join(script_dir, 'chromedriver.exe' if os.name == 'nt' else 'chromedriver')
        
        # Если ChromeDriver есть и совместим, используем его
        if os.path.exists(chromedriver_path):
            chrome_version = get_chrome_version()
            if chrome_version:
                if is_chromedriver_compatible(chromedriver_path, chrome_version):
                    print(f"[ChromeDriverManager] Compatible ChromeDriver found: {chromedriver_path}")
                    self.chromedriver_path = chromedriver_path
                    self.setup_complete = True
                    return chromedriver_path
                else:
                    print("[ChromeDriverManager] Existing ChromeDriver is not compatible, updating...")
            else:
                print("[ChromeDriverManager] Cannot detect Chrome version, using existing ChromeDriver")
                self.chromedriver_path = chromedriver_path
                self.setup_complete = True
                return chromedriver_path
        
        # Настраиваем ChromeDriver
        return self.setup_chromedriver()
    
    def setup_chromedriver(self):
        """Настройка ChromeDriver"""
        try:
            print("[ChromeDriverManager] Setting up ChromeDriver...")
            
            chromedriver_path = setup_chromedriver(force=True)
            
            if chromedriver_path and os.path.exists(chromedriver_path):
                print(f"[ChromeDriverManager] ChromeDriver setup successful: {chromedriver_path}")
                self.chromedriver_path = chromedriver_path
                self.setup_complete = True
                return chromedriver_path
            else:
                error_msg = "Failed to setup ChromeDriver"
                print(f"[ChromeDriverManager] {error_msg}")
                self.setup_error = error_msg
                return None
                
        except Exception as e:
            error_msg = f"Error setting up ChromeDriver: {e}"
            print(f"[ChromeDriverManager] {error_msg}")
            self.setup_error = error_msg
            return None
    
    def setup_chromedriver_async(self, callback=None):
        """Асинхронная настройка ChromeDriver"""
        def setup_thread():
            result = self.ensure_chromedriver_ready()
            if callback:
                callback(result, self.setup_error)
        
        thread = threading.Thread(target=setup_thread, daemon=True)
        thread.start()
        return thread
    
    def get_status(self):
        """Получить статус настройки ChromeDriver"""
        return {
            "setup_complete": self.setup_complete,
            "chromedriver_path": self.chromedriver_path,
            "error": self.setup_error,
            "chrome_version": get_chrome_version()
        }

# Глобальный экземпляр менеджера
_chromedriver_manager = ChromeDriverManager()

def get_chromedriver_manager():
    """Получить глобальный экземпляр менеджера ChromeDriver"""
    return _chromedriver_manager

def ensure_chromedriver_ready():
    """Удобная функция для обеспечения готовности ChromeDriver"""
    return _chromedriver_manager.ensure_chromedriver_ready()

def get_chromedriver_status():
    """Получить статус ChromeDriver"""
    return _chromedriver_manager.get_status()

# Функция для предварительной настройки при импорте модуля
def presetup_chromedriver():
    """Предварительная настройка ChromeDriver в фоновом режиме"""
    print("[ChromeDriverManager] Starting background ChromeDriver setup...")
    
    def setup_callback(result, error):
        if result:
            print(f"[ChromeDriverManager] Background setup completed: {result}")
        else:
            print(f"[ChromeDriverManager] Background setup failed: {error}")
    
    _chromedriver_manager.setup_chromedriver_async(setup_callback)

# Автоматическая предварительная настройка при импорте
# Отключаем для избежания проблем с CircularImport
# if __name__ != "__main__":
#     # Запускаем предварительную настройку только если модуль импортируется
#     try:
#         presetup_chromedriver()
#     except Exception as e:
#         print(f"[ChromeDriverManager] Error during pre-setup: {e}")

if __name__ == "__main__":
    # Тестирование менеджера
    print("Testing ChromeDriver Manager...")
    
    manager = get_chromedriver_manager()
    
    print("\nStatus before setup:")
    print(manager.get_status())
    
    print("\nEnsuring ChromeDriver is ready...")
    result = manager.ensure_chromedriver_ready()
    
    print(f"\nSetup result: {result}")
    print("\nFinal status:")
    print(manager.get_status())