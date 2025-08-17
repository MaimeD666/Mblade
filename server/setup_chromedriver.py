import os
import sys
import requests
import zipfile
import platform
import json
from pathlib import Path

def get_chrome_version():
    system = platform.system().lower()
    
    if system == "windows":
        return get_chrome_version_windows()
    elif system == "darwin":
        return get_chrome_version_macos()
    elif system == "linux":
        return get_chrome_version_linux()
    
    return None

def get_chrome_version_windows():
    """Получает версию Chrome на Windows используя различные методы"""
    import subprocess
    
    # Метод 1: Через реестр (HKEY_CURRENT_USER)
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Google\Chrome\BLBeacon")
        version, _ = winreg.QueryValueEx(key, "version")
        if version:
            print(f"Chrome version found via HKEY_CURRENT_USER: {version}")
            return version
    except Exception as e:
        print(f"Failed to get version from HKEY_CURRENT_USER: {e}")
    
    # Метод 2: Через реестр (HKEY_LOCAL_MACHINE)
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Google\Chrome\BLBeacon")
        version, _ = winreg.QueryValueEx(key, "version")
        if version:
            print(f"Chrome version found via HKEY_LOCAL_MACHINE: {version}")
            return version
    except Exception as e:
        print(f"Failed to get version from HKEY_LOCAL_MACHINE: {e}")
    
    # Метод 3: Через WOW64 реестр для 32-битных приложений на 64-битной системе
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Google\Chrome\BLBeacon")
        version, _ = winreg.QueryValueEx(key, "version")
        if version:
            print(f"Chrome version found via WOW6432Node: {version}")
            return version
    except Exception as e:
        print(f"Failed to get version from WOW6432Node: {e}")
    
    # Метод 4: Через исполняемый файл Chrome
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe"),
    ]
    
    for chrome_path in chrome_paths:
        try:
            if os.path.exists(chrome_path):
                result = subprocess.run([chrome_path, '--version'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    version = result.stdout.strip().split()[-1]
                    print(f"Chrome version found via executable ({chrome_path}): {version}")
                    return version
        except Exception as e:
            print(f"Failed to get version from {chrome_path}: {e}")
    
    # Метод 5: Через WMIC (Windows Management Instrumentation)
    try:
        result = subprocess.run([
            'wmic', 'datafile', 'where', 
            'name="C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"', 
            'get', 'Version', '/value'
        ], capture_output=True, text=True, timeout=15)
        
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line.startswith('Version='):
                    version = line.split('=')[1].strip()
                    if version:
                        print(f"Chrome version found via WMIC: {version}")
                        return version
    except Exception as e:
        print(f"Failed to get version via WMIC: {e}")
    
    # Метод 6: Через PowerShell
    try:
        ps_command = '''
        $chromePath = @(
            "${env:ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe",
            "${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe",
            "$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe"
        )
        foreach ($path in $chromePath) {
            if (Test-Path $path) {
                $version = (Get-ItemProperty $path).VersionInfo.FileVersion
                if ($version) { 
                    Write-Output $version
                    break 
                }
            }
        }
        '''
        
        result = subprocess.run(['powershell', '-Command', ps_command], 
                              capture_output=True, text=True, timeout=15)
        if result.returncode == 0 and result.stdout.strip():
            version = result.stdout.strip()
            print(f"Chrome version found via PowerShell: {version}")
            return version
    except Exception as e:
        print(f"Failed to get version via PowerShell: {e}")
    
    print("Failed to detect Chrome version on Windows using all methods")
    return None

def get_chrome_version_macos():
    """Получает версию Chrome на macOS"""
    import subprocess
    
    try:
        result = subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            version = result.stdout.strip().split()[-1]
            print(f"Chrome version found on macOS: {version}")
            return version
    except Exception as e:
        print(f"Failed to get Chrome version on macOS: {e}")
    
    return None

def get_chrome_version_linux():
    """Получает версию Chrome на Linux"""
    import subprocess
    
    chrome_commands = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']
    
    for cmd in chrome_commands:
        try:
            result = subprocess.run([cmd, '--version'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                version = result.stdout.strip().split()[-1]
                print(f"Chrome version found on Linux via {cmd}: {version}")
                return version
        except Exception as e:
            print(f"Failed to get Chrome version via {cmd}: {e}")
    
    return None

def get_chromedriver_version_for_chrome(chrome_version):
    """Получает подходящую версию ChromeDriver для указанной версии Chrome"""
    if not chrome_version:
        return get_latest_chromedriver_version()
    
    major_version = int(chrome_version.split('.')[0])
    
    # Для Chrome 115+ используем Chrome for Testing API
    if major_version >= 115:
        return get_chromedriver_version_new_api(chrome_version)
    else:
        # Для старых версий Chrome используем старое API
        return get_chromedriver_version_old_api(major_version)

def get_chromedriver_version_new_api(chrome_version):
    """Получает версию ChromeDriver через новое Chrome for Testing API (Chrome 115+)"""
    try:
        # Пытаемся найти точную версию
        url = "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json"
        response = requests.get(url, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            
            # Ищем точную версию
            for version_info in data.get('versions', []):
                if version_info.get('version') == chrome_version:
                    print(f"Found exact ChromeDriver version for Chrome {chrome_version}")
                    return chrome_version
            
            # Если точной версии нет, ищем ближайшую подходящую
            major_minor = '.'.join(chrome_version.split('.')[0:2])
            for version_info in data.get('versions', []):
                if version_info.get('version', '').startswith(major_minor):
                    driver_version = version_info.get('version')
                    print(f"Found compatible ChromeDriver version {driver_version} for Chrome {chrome_version}")
                    return driver_version
        
        # Если через API не получилось, пытаемся через latest API
        major_version = chrome_version.split('.')[0]
        url = f"https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            builds = data.get('builds', {})
            if major_version in builds:
                version = builds[major_version].get('version')
                if version:
                    print(f"Found ChromeDriver version {version} for Chrome major version {major_version}")
                    return version
    
    except Exception as e:
        print(f"Failed to get ChromeDriver version via new API: {e}")
    
    # Fallback: используем версию Chrome как есть (для Chrome 115+ это обычно работает)
    return chrome_version

def get_chromedriver_version_old_api(major_version):
    """Получает версию ChromeDriver через старое API (Chrome <115)"""
    try:
        # Пытаемся получить версию для конкретной мажорной версии
        url = f'https://chromedriver.storage.googleapis.com/LATEST_RELEASE_{major_version}'
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            version = response.text.strip()
            print(f"Found ChromeDriver version {version} for Chrome major version {major_version}")
            return version
    except Exception as e:
        print(f"Failed to get ChromeDriver version for major version {major_version}: {e}")
    
    # Fallback: получаем последнюю доступную версию
    return get_latest_chromedriver_version()

def get_latest_chromedriver_version():
    """Получает последнюю доступную версию ChromeDriver"""
    try:
        # Сначала пробуем новое API
        url = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            version = data.get('channels', {}).get('Stable', {}).get('version')
            if version:
                print(f"Latest ChromeDriver version from new API: {version}")
                return version
    except Exception as e:
        print(f"Failed to get latest version from new API: {e}")
    
    try:
        # Fallback на старое API
        response = requests.get('https://chromedriver.storage.googleapis.com/LATEST_RELEASE', timeout=10)
        if response.status_code == 200:
            version = response.text.strip()
            print(f"Latest ChromeDriver version from old API: {version}")
            return version
    except Exception as e:
        print(f"Failed to get latest version from old API: {e}")
    
    return None

def download_chromedriver(version, output_dir):
    """Загружает ChromeDriver указанной версии"""
    system = platform.system().lower()
    
    if system == "windows":
        platform_name = "win32"
        exe_name = "chromedriver.exe"
    elif system == "darwin":
        if platform.machine().lower() == 'arm64':
            platform_name = "mac-arm64"
        else:
            platform_name = "mac-x64"
        exe_name = "chromedriver"
    else:
        platform_name = "linux64"
        exe_name = "chromedriver"
    
    # Определяем, какое API использовать на основе версии
    major_version = int(version.split('.')[0])
    
    if major_version >= 115:
        return download_chromedriver_new_api(version, platform_name, exe_name, output_dir)
    else:
        return download_chromedriver_old_api(version, platform_name, exe_name, output_dir)

def download_chromedriver_new_api(version, platform_name, exe_name, output_dir):
    """Загружает ChromeDriver через новое Chrome for Testing API"""
    # Маппинг платформ для нового API
    platform_mapping = {
        "win32": "win32",
        "mac-x64": "mac-x64", 
        "mac-arm64": "mac-arm64",
        "linux64": "linux64"
    }
    
    api_platform = platform_mapping.get(platform_name, platform_name)
    url = f"https://storage.googleapis.com/chrome-for-testing-public/{version}/{api_platform}/chromedriver-{api_platform}.zip"
    
    print(f"Downloading ChromeDriver {version} for {api_platform} via new API...")
    
    return download_and_extract_chromedriver(url, exe_name, output_dir, version, api_platform)

def download_chromedriver_old_api(version, platform_name, exe_name, output_dir):
    """Загружает ChromeDriver через старое API"""
    # Маппинг для старого API
    platform_mapping = {
        "win32": "win32",
        "mac-x64": "mac64",
        "mac-arm64": "mac64_m1", 
        "linux64": "linux64"
    }
    
    api_platform = platform_mapping.get(platform_name, platform_name)
    url = f"https://chromedriver.storage.googleapis.com/{version}/chromedriver_{api_platform}.zip"
    
    print(f"Downloading ChromeDriver {version} for {api_platform} via old API...")
    
    return download_and_extract_chromedriver(url, exe_name, output_dir, version, api_platform)

def download_and_extract_chromedriver(url, exe_name, output_dir, version, platform_name):
    """Общая функция для загрузки и извлечения ChromeDriver"""
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        zip_path = os.path.join(output_dir, "chromedriver.zip")
        
        with open(zip_path, 'wb') as f:
            f.write(response.content)
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Извлекаем все файлы
            zip_ref.extractall(output_dir)
        
        os.remove(zip_path)
        
        # Ищем извлеченный chromedriver
        chromedriver_path = None
        
        # Сначала пробуем в корне
        direct_path = os.path.join(output_dir, exe_name)
        if os.path.exists(direct_path):
            chromedriver_path = direct_path
        else:
            # Ищем в подпапках (новое API создает папки)
            for root, dirs, files in os.walk(output_dir):
                if exe_name in files:
                    chromedriver_path = os.path.join(root, exe_name)
                    # Перемещаем в корень output_dir
                    final_path = os.path.join(output_dir, exe_name)
                    if chromedriver_path != final_path:
                        import shutil
                        shutil.move(chromedriver_path, final_path)
                        chromedriver_path = final_path
                    break
        
        if chromedriver_path and os.path.exists(chromedriver_path):
            # Устанавливаем права на выполнение для Unix-систем
            if platform.system().lower() != "windows":
                os.chmod(chromedriver_path, 0o755)
            
            print(f"ChromeDriver downloaded to: {chromedriver_path}")
            return chromedriver_path
        else:
            print(f"ChromeDriver executable not found after extraction")
            return None
        
    except Exception as e:
        print(f"Error downloading ChromeDriver: {e}")
        return None

def setup_chromedriver(force=False):
    """Настройка ChromeDriver с автоматическим определением версии Chrome"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    chromedriver_path = os.path.join(script_dir, "chromedriver.exe" if platform.system() == "Windows" else "chromedriver")
    
    # Проверяем, существует ли уже ChromeDriver
    if os.path.exists(chromedriver_path) and not force:
        print(f"ChromeDriver already exists: {chromedriver_path}")
        
        # Проверяем совместимость с текущим Chrome
        if not force:
            chrome_version = get_chrome_version()
            if chrome_version:
                if is_chromedriver_compatible(chromedriver_path, chrome_version):
                    print(f"Existing ChromeDriver is compatible with Chrome {chrome_version}")
                    return chromedriver_path
                else:
                    print(f"Existing ChromeDriver is not compatible with Chrome {chrome_version}")
                    print("Downloading compatible version...")
            else:
                print("Could not detect Chrome version, using existing ChromeDriver")
                return chromedriver_path
    
    # Определяем версию Chrome
    chrome_version = get_chrome_version()
    if chrome_version:
        print(f"Detected Chrome version: {chrome_version}")
        driver_version = get_chromedriver_version_for_chrome(chrome_version)
    else:
        print("Could not detect Chrome version, using latest ChromeDriver")
        driver_version = get_latest_chromedriver_version()
    
    if not driver_version:
        print("Failed to get ChromeDriver version")
        return None
    
    print(f"Using ChromeDriver version: {driver_version}")
    
    # Удаляем старый ChromeDriver, если он существует
    if os.path.exists(chromedriver_path):
        try:
            os.remove(chromedriver_path)
            print("Removed old ChromeDriver")
        except Exception as e:
            print(f"Warning: Could not remove old ChromeDriver: {e}")
    
    return download_chromedriver(driver_version, script_dir)

def is_chromedriver_compatible(chromedriver_path, chrome_version):
    """Проверяет совместимость существующего ChromeDriver с версией Chrome"""
    try:
        import subprocess
        
        # Получаем версию ChromeDriver
        result = subprocess.run([chromedriver_path, '--version'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            return False
        
        # Извлекаем версию из вывода
        driver_version_line = result.stdout.strip()
        # Формат: "ChromeDriver 120.0.6099.109 (3419140ab66..."
        if "ChromeDriver" in driver_version_line:
            driver_version = driver_version_line.split()[1]
        else:
            return False
        
        # Сравниваем мажорные версии
        chrome_major = int(chrome_version.split('.')[0])
        driver_major = int(driver_version.split('.')[0])
        
        # Для Chrome 115+ версии должны точно совпадать по мажорной версии
        # Для более старых версий допускается небольшое расхождение
        if chrome_major >= 115:
            compatibility = abs(chrome_major - driver_major) <= 0
        else:
            compatibility = abs(chrome_major - driver_major) <= 3
        
        print(f"ChromeDriver version: {driver_version}, Chrome version: {chrome_version}")
        print(f"Compatibility check: {'PASS' if compatibility else 'FAIL'}")
        
        return compatibility
        
    except Exception as e:
        print(f"Error checking ChromeDriver compatibility: {e}")
        return False

def test_chromedriver():
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        
        script_dir = os.path.dirname(os.path.abspath(__file__))
        chromedriver_path = os.path.join(script_dir, "chromedriver.exe" if platform.system() == "Windows" else "chromedriver")
        
        if not os.path.exists(chromedriver_path):
            print("ChromeDriver not found")
            return False
        
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        service = Service(chromedriver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        driver.get('https://www.google.com')
        title = driver.title
        driver.quit()
        
        print(f"ChromeDriver test successful! Page title: {title}")
        return True
        
    except Exception as e:
        print(f"ChromeDriver test failed: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--force":
        force = True
    else:
        force = False
    
    print("Setting up ChromeDriver for YouTube authentication...")
    
    chromedriver_path = setup_chromedriver(force=force)
    
    if chromedriver_path:
        print("Testing ChromeDriver...")
        if test_chromedriver():
            print("[SUCCESS] ChromeDriver setup complete!")
            print(f"Path: {chromedriver_path}")
        else:
            print("[FAILED] ChromeDriver test failed")
            sys.exit(1)
    else:
        print("[FAILED] Failed to setup ChromeDriver")
        sys.exit(1)