import os
import platform
import sys
import subprocess

def check_ffmpeg_installation():
    print("Проверка установки FFmpeg в проекте...")
    
    # Определяем текущую платформу
    system = platform.system().lower()
    print(f"Обнаружена операционная система: {system}")
    
    # Базовый путь к папке с FFmpeg в проекте
    base_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin', 'ffmpeg')
    
    if system == 'windows':
        ffmpeg_path = os.path.join(base_path, 'windows', 'ffmpeg.exe')
        ffprobe_path = os.path.join(base_path, 'windows', 'ffprobe.exe')
    elif system == 'darwin':  # macOS
        ffmpeg_path = os.path.join(base_path, 'macos', 'ffmpeg')
        ffprobe_path = os.path.join(base_path, 'macos', 'ffprobe')
    else:  # Linux и другие Unix-системы
        ffmpeg_path = os.path.join(base_path, 'linux', 'ffmpeg')
        ffprobe_path = os.path.join(base_path, 'linux', 'ffprobe')
    
    success = True
    
    # Проверяем, существуют ли файлы
    if not os.path.exists(ffmpeg_path):
        print(f"❌ FFmpeg не найден по пути: {ffmpeg_path}")
        success = False
    else:
        print(f"✅ FFmpeg найден по пути: {ffmpeg_path}")
        
        # Устанавливаем права на выполнение для Unix-систем
        if system != 'windows':
            try:
                os.chmod(ffmpeg_path, 0o755)  # rwxr-xr-x
                print(f"✅ Установлены права на выполнение для FFmpeg")
            except Exception as e:
                print(f"❌ Не удалось установить права на исполнение для {ffmpeg_path}: {e}")
                success = False
    
    if not os.path.exists(ffprobe_path):
        print(f"❌ FFprobe не найден по пути: {ffprobe_path}")
        success = False
    else:
        print(f"✅ FFprobe найден по пути: {ffprobe_path}")
        
        # Устанавливаем права на выполнение для Unix-систем
        if system != 'windows':
            try:
                os.chmod(ffprobe_path, 0o755)  # rwxr-xr-x
                print(f"✅ Установлены права на выполнение для FFprobe")
            except Exception as e:
                print(f"❌ Не удалось установить права на исполнение для {ffprobe_path}: {e}")
                success = False
    
    # Проверяем работоспособность FFmpeg, если он найден
    if os.path.exists(ffmpeg_path):
        try:
            if system == 'windows':
                # В Windows используем shell=True для запуска .exe
                result = subprocess.run(f'"{ffmpeg_path}" -version', shell=True, capture_output=True, text=True)
            else:
                # В Unix используем список аргументов
                result = subprocess.run([ffmpeg_path, "-version"], capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"✅ FFmpeg успешно запущен и вернул версию:")
                print(result.stdout.split('\n')[0])
            else:
                print(f"❌ FFmpeg найден, но не запускается. Ошибка:")
                print(result.stderr)
                success = False
        except Exception as e:
            print(f"❌ Ошибка при запуске FFmpeg: {e}")
            success = False
    
    # Итоговый результат
    if success:
        print("\n✅ FFmpeg успешно установлен и готов к использованию!")
    else:
        print("\n❌ Обнаружены проблемы с установкой FFmpeg.")
        print("Пожалуйста, проверьте наличие файлов FFmpeg в соответствующей директории для вашей платформы.")
        print(f"Путь к директории FFmpeg для вашей платформы: {os.path.dirname(ffmpeg_path)}")
    
    return success

if __name__ == "__main__":
    check_ffmpeg_installation()