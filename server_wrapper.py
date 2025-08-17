import os
import sys
import webbrowser
import threading
import time
import subprocess
import socket
import logging
import json
import signal

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("MusicAppWrapper")

# Определяем, находимся ли мы в PyInstaller bundle
def is_bundled():
    return getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS')

# Получаем корректный путь к ресурсам в зависимости от режима запуска
def get_resource_path(relative_path):
    if is_bundled():
        # Если приложение упаковано PyInstaller, ресурсы находятся в _MEIPASS
        base_path = sys._MEIPASS
    else:
        # В режиме разработки используем текущую директорию
        base_path = os.path.abspath(os.path.dirname(__file__))
    
    return os.path.join(base_path, relative_path)

# Функция для проверки, свободен ли порт
def is_port_available(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) != 0

# Находим свободный порт
def find_free_port(start_port=5000, max_attempts=100):
    for port in range(start_port, start_port + max_attempts):
        if is_port_available(port):
            return port
    raise RuntimeError(f"Не удалось найти свободный порт после {max_attempts} попыток")

# Создаем файл с настройками
def create_config(server_port):
    config = {
        'server_url': f'http://localhost:{server_port}'
    }
    
    config_dir = os.path.join(os.path.expanduser("~"), ".musicapp")
    os.makedirs(config_dir, exist_ok=True)
    
    config_path = os.path.join(config_dir, "config.json")
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f)
    
    return config_path

# Функция для запуска сервера
def start_server(port):
    try:
        logger.info(f"Запуск сервера на порту {port}")
        
        # Определяем путь к серверному скрипту
        if is_bundled():
            server_dir = os.path.join(sys._MEIPASS, 'server')
        else:
            server_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server')
        
        # Переходим в директорию сервера
        os.chdir(server_dir)
        
        # Импортируем и запускаем Flask приложение
        sys.path.insert(0, server_dir)
        
        # Делаем скрипт запускаемым в режиме внешнего модуля
        from server.app import app
        
        # Запускаем сервер на указанном порту
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
    except Exception as e:
        logger.error(f"Ошибка при запуске сервера: {e}")
        raise

# Функция для открытия браузера
def open_browser(port, delay=2):
    def _open_browser():
        time.sleep(delay)  # Даем серверу время для запуска
        url = f"http://localhost:{port}"
        logger.info(f"Открываем браузер с URL: {url}")
        webbrowser.open(url)
    
    browser_thread = threading.Thread(target=_open_browser)
    browser_thread.daemon = True
    browser_thread.start()

# Обработчик сигналов завершения
def setup_signal_handlers():
    def signal_handler(sig, frame):
        logger.info("Получен сигнал завершения, выходим...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

# Главная функция
def main():
    try:
        logger.info("Запуск Music App")
        
        # Настройка обработчиков сигналов
        setup_signal_handlers()
        
        # Находим свободный порт
        port = find_free_port()
        logger.info(f"Найден свободный порт: {port}")
        
        # Создаем конфигурационный файл
        config_path = create_config(port)
        logger.info(f"Создан конфигурационный файл: {config_path}")
        
        # Открываем браузер после запуска сервера
        open_browser(port)
        
        # Запускаем сервер
        start_server(port)
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
        input("Нажмите Enter для выхода...")
        sys.exit(1)

if __name__ == "__main__":
    main()