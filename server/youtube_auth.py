import os
import time
import json
import threading
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

class YouTubeSeleniumAuth:
    def __init__(self, user_data_dir, headless=False):
        self.driver = None
        self.headless = headless
        self.cookies = {}
        self.user_data_dir = user_data_dir
        self.cookie_file = os.path.join(user_data_dir, 'youtube_cookies.txt')
        
    def setup_driver(self):
        chrome_options = Options()
        
        # Автоматически отключаем headless для exe файлов (чтобы окно открывалось нормально)
        if self.headless and not self.is_running_as_exe():
            chrome_options.add_argument('--headless')
            print("[Selenium] Running in headless mode (manually enabled)")
        elif self.is_running_as_exe():
            print("[Selenium] Running in windowed mode (exe detected - Chrome window will be visible)")
        
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage') 
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--window-size=1200,800')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # Дополнительные настройки для headless режима
        if self.headless and not self.is_running_as_exe():
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--disable-web-security')
            chrome_options.add_argument('--allow-running-insecure-content')
        
        try:
            chromedriver_path = self.get_chromedriver_path()
            if chromedriver_path:
                service = Service(chromedriver_path)
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
            else:
                self.driver = webdriver.Chrome(options=chrome_options)
                
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            return True
            
        except Exception as e:
            print(f"[Selenium] Error setting up driver: {e}")
            return False
    
    def is_running_as_exe(self):
        """Определяет, запущено ли приложение как exe файл"""
        return hasattr(os.sys, '_MEIPASS')
    
    def get_chromedriver_path(self):
        """Получает путь к ChromeDriver, автоматически настраивая его при необходимости"""
        # Сначала проверяем в exe bundle
        if hasattr(os.sys, '_MEIPASS'):
            chromedriver_path = os.path.join(os.sys._MEIPASS, 'chromedriver.exe')
            if os.path.exists(chromedriver_path):
                print(f"[ChromeDriver] Using bundled ChromeDriver: {chromedriver_path}")
                return chromedriver_path
        
        # Используем менеджер ChromeDriver для автоматической настройки
        try:
            from chromedriver_manager import ensure_chromedriver_ready
            
            print("[ChromeDriver] Using automatic ChromeDriver management...")
            chromedriver_path = ensure_chromedriver_ready()
            if chromedriver_path and os.path.exists(chromedriver_path):
                print(f"[ChromeDriver] Using managed ChromeDriver: {chromedriver_path}")
                return chromedriver_path
            else:
                print("[ChromeDriver] ChromeDriver manager failed to provide valid ChromeDriver")
                return self.fallback_chromedriver_setup()
                
        except ImportError as e:
            print(f"[ChromeDriver] ChromeDriver manager not available: {e}")
            return self.fallback_chromedriver_setup()
        except Exception as e:
            print(f"[ChromeDriver] Error using ChromeDriver manager: {e}")
            return self.fallback_chromedriver_setup()
    
    def fallback_chromedriver_setup(self):
        """Fallback метод для настройки ChromeDriver без менеджера"""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        chromedriver_path = os.path.join(script_dir, 'chromedriver.exe' if os.name == 'nt' else 'chromedriver')
        
        if os.path.exists(chromedriver_path):
            print(f"[ChromeDriver] Using existing ChromeDriver (fallback): {chromedriver_path}")
            return chromedriver_path
        
        try:
            from setup_chromedriver import setup_chromedriver
            print("[ChromeDriver] Setting up ChromeDriver (fallback)...")
            chromedriver_path = setup_chromedriver(force=True)
            
            if chromedriver_path and os.path.exists(chromedriver_path):
                print(f"[ChromeDriver] Fallback setup successful: {chromedriver_path}")
                return chromedriver_path
            else:
                print("[ChromeDriver] Fallback setup failed")
                return None
                
        except Exception as e:
            print(f"[ChromeDriver] Fallback setup error: {e}")
            return None
    
    def login_interactive(self):
        if not self.setup_driver():
            return None
        
        try:
            print("[Selenium] Opening YouTube login page...")
            self.driver.get('https://accounts.google.com/signin/v2/identifier?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F')
            
            print("[Selenium] Please log into your Google account in the opened browser window...")
            print("[Selenium] Waiting for login completion (will auto-detect when done)...")
            
            # Автоматическое ожидание завершения авторизации
            login_completed = self.wait_for_login_completion()
            
            if not login_completed:
                print("[Selenium] Login timeout or cancelled")
                return None
            
            # cookies уже получены в wait_for_login_completion
            if self.is_logged_in():
                print(f"[Selenium] Login successful! Got {len(self.cookies)} cookies")
                return self.cookies
            else:
                print("[Selenium] Could not verify login")
                return None
        
        except Exception as e:
            print(f"[Selenium] Login error: {e}")
            return None
        
        finally:
            if self.driver:
                self.driver.quit()
    
    def wait_for_login_completion(self, timeout=300):
        """
        Автоматически ожидает завершения процесса авторизации
        """
        print(f"[Selenium] Автоматическое ожидание входа (таймаут: {timeout} секунд)...")
        
        start_time = time.time()
        check_interval = 3  # Проверяем каждые 3 секунды
        
        while time.time() - start_time < timeout:
            try:
                current_url = self.driver.current_url
                print(f"[Selenium] Текущий URL: {current_url}")
                
                # Сначала ждем завершения процесса авторизации на Google
                if any(pattern in current_url for pattern in [
                    'accounts.google.com/signin',
                    'accounts.google.com/v3/signin', 
                    'accounts.google.com/speedbump',
                    'accounts.google.com/challenge'
                ]):
                    print("[Selenium] Все еще на странице авторизации Google...")
                    time.sleep(check_interval)
                    continue
                
                # Проверяем успешные признаки завершения авторизации
                success_patterns = [
                    'youtube.com',
                    'myaccount.google.com',
                    'accounts.google.com/ManageAccount',
                    'accounts.google.com/b/0/ManageAccount'
                ]
                
                if any(pattern in current_url for pattern in success_patterns):
                    print(f"[Selenium] Успешная авторизация! URL: {current_url}")
                    
                    # Дополнительная проверка - переходим на YouTube и проверяем cookies
                    print("[Selenium] Переходим на YouTube для проверки cookies...")
                    self.driver.get('https://www.youtube.com/')
                    
                    # Ждем загрузки YouTube
                    WebDriverWait(self.driver, 15).until(
                        EC.presence_of_element_located((By.TAG_NAME, "body"))
                    )
                    
                    time.sleep(3)  # Даем время cookies загрузиться
                    
                    # Проверяем cookies
                    cookies = self.driver.get_cookies()
                    youtube_cookies = {
                        cookie.get('name'): cookie.get('value') 
                        for cookie in cookies 
                        if 'youtube.com' in cookie.get('domain', '')
                    }
                    
                    # Проверяем наличие важных cookies авторизации
                    auth_cookie_names = ['SAPISID', 'APISID', 'LOGIN_INFO', '__Secure-1PAPISID', '__Secure-3PAPISID']
                    found_auth_cookies = [name for name in auth_cookie_names if name in youtube_cookies]
                    
                    print(f"[Selenium] Найдено cookies: {len(youtube_cookies)}")
                    print(f"[Selenium] Cookies авторизации: {found_auth_cookies}")
                    
                    if found_auth_cookies:
                        print("[Selenium] Авторизация подтверждена наличием cookies!")
                        self.cookies = youtube_cookies  # Сохраняем cookies
                        return True
                    else:
                        print("[Selenium] Cookies авторизации не найдены, продолжаем ожидание...")
                        time.sleep(check_interval)
                        continue
                
                # Проверяем, не закрыл ли пользователь браузер
                try:
                    self.driver.current_window_handle
                except:
                    print("[Selenium] Браузер был закрыт пользователем")
                    return False
                
                time.sleep(check_interval)
                
            except Exception as e:
                print(f"[Selenium] Ошибка при ожидании авторизации: {e}")
                time.sleep(check_interval)
        
        print("[Selenium] Таймаут ожидания авторизации")
        return False
    
    def login_with_credentials(self, email, password):
        if not self.setup_driver():
            return None
        
        try:
            print("[Selenium] Automatic login...")
            self.driver.get('https://accounts.google.com/signin/v2/identifier?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F')
            
            email_input = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.ID, "identifierId"))
            )
            email_input.send_keys(email)
            
            next_button = self.driver.find_element(By.ID, "identifierNext")
            next_button.click()
            
            password_input = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.NAME, "password"))
            )
            password_input.send_keys(password)
            
            password_next = self.driver.find_element(By.ID, "passwordNext")
            password_next.click()
            
            # Автоматическое ожидание завершения (может потребоваться 2FA)
            print("[Selenium] Ожидание завершения авторизации (возможно потребуется 2FA)...")
            login_completed = self.wait_for_login_completion(timeout=180)  # 3 минуты для 2FA
            
            if not login_completed:
                print("[Selenium] Не удалось завершить автоматический вход")
                return None
            
            if self.is_logged_in():
                print(f"[Selenium] Automatic login successful! Got {len(self.cookies)} cookies")
                return self.cookies
            else:
                print("[Selenium] Automatic login failed - cookies verification failed")
                return None
        
        except Exception as e:
            print(f"[Selenium] Automatic login error: {e}")
            print("[Selenium] Switching to interactive mode for manual completion...")
            
            # Переключаемся на автоматическое ожидание вместо input()
            login_completed = self.wait_for_login_completion(timeout=180)
            if login_completed and self.is_logged_in():
                return self.cookies
            else:
                print("[Selenium] Manual completion also failed")
                return None
        
        finally:
            if self.driver:
                self.driver.quit()
    
    def get_current_cookies(self):
        """Получает текущие cookies с YouTube (используется как fallback)"""
        try:
            if self.driver:
                self.driver.get('https://www.youtube.com/')
                
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                time.sleep(3)  # Ждем загрузки cookies
                
                cookies = self.driver.get_cookies()
                youtube_cookies = {}
                
                for cookie in cookies:
                    if 'youtube.com' in cookie.get('domain', ''):
                        youtube_cookies[cookie['name']] = cookie['value']
                
                self.cookies = youtube_cookies
                print(f"[Selenium] Получено {len(youtube_cookies)} cookies с YouTube")
                return youtube_cookies
        except Exception as e:
            print(f"[Selenium] Ошибка получения cookies: {e}")
        
        return {}
    
    def is_logged_in(self):
        if not self.cookies:
            return False
            
        # Расширенный список cookies для проверки авторизации
        auth_cookies = [
            'LOGIN_INFO', 'SAPISID', 'APISID', '__Secure-1PAPISID', 
            '__Secure-3PAPISID', '__Secure-1PSID', '__Secure-3PSID',
            'VISITOR_INFO1_LIVE', 'YSC'
        ]
        
        found_cookies = []
        for cookie_name in auth_cookies:
            if cookie_name in self.cookies:
                found_cookies.append(cookie_name)
        
        # Считаем авторизованным если есть хотя бы один из важных cookies
        critical_cookies = ['SAPISID', 'APISID', 'LOGIN_INFO']
        has_critical = any(cookie in self.cookies for cookie in critical_cookies)
        
        print(f"[Selenium] Найденные cookies авторизации: {found_cookies}")
        print(f"[Selenium] Есть критически важные cookies: {has_critical}")
        
        return has_critical
    
    def save_cookies_for_ytdlp(self):
        if not self.cookies:
            print("[Selenium] Нет cookies для сохранения")
            return False
        
        try:
            print(f"[Selenium] Сохраняем {len(self.cookies)} cookies...")
            
            with open(self.cookie_file, 'w', encoding='utf-8') as f:
                f.write("# Netscape HTTP Cookie File\n")
                f.write("# Generated by Selenium login\n")
                
                expire_time = int(time.time()) + (30 * 24 * 60 * 60)
                
                for name, value in self.cookies.items():
                    # Исправленное определение домена и флагов
                    if name.startswith('__Secure-'):
                        # Secure cookies должны использовать точный домен
                        domain = "youtube.com"
                        subdomain_flag = "FALSE"  # Точный домен, не поддомены
                        secure = "TRUE"
                    else:
                        # Обычные cookies могут работать с поддоменами
                        domain = ".youtube.com" 
                        subdomain_flag = "TRUE"   # Включая поддомены
                        secure = "FALSE"
                    
                    # Формат: domain, subdomain_flag, path, secure, expiration, name, value
                    f.write(f"{domain}\t{subdomain_flag}\t/\t{secure}\t{expire_time}\t{name}\t{value}\n")
            
            # Проверяем сохранение
            file_size = os.path.getsize(self.cookie_file)
            print(f"[Selenium] Cookies сохранены в {self.cookie_file} (размер: {file_size} байт)")
            
            # Список важных cookies для диагностики
            important_cookies = ['LOGIN_INFO', 'SAPISID', 'APISID', '__Secure-1PAPISID', '__Secure-3PAPISID']
            saved_important = [name for name in important_cookies if name in self.cookies]
            print(f"[Selenium] Сохранены важные cookies: {saved_important}")
            
            return True
            
        except Exception as e:
            print(f"[Selenium] Ошибка сохранения cookies: {e}")
            return False
    
    def check_existing_cookies(self):
        if not os.path.exists(self.cookie_file):
            return False
            
        try:
            with open(self.cookie_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if not content.strip():
                return False
                
            essential_cookies = ['LOGIN_INFO', 'VISITOR_INFO1_LIVE', 'SAPISID', 'APISID']
            has_essential = any(cookie in content for cookie in essential_cookies)
            
            if has_essential:
                print(f"[Selenium] Found existing cookies: {self.cookie_file}")
                return True
                
        except Exception as e:
            print(f"[Selenium] Error checking cookies: {e}")
            
        return False

def youtube_login_selenium(user_data_dir, email=None, password=None, headless=False, force_reauth=False):
    auth = YouTubeSeleniumAuth(user_data_dir, headless=headless)
    
    if not force_reauth and auth.check_existing_cookies():
        print("[Selenium] Using existing cookies")
        return auth.cookie_file
    
    try:
        if email and password:
            cookies = auth.login_with_credentials(email, password)
        else:
            cookies = auth.login_interactive()
        
        if cookies and auth.save_cookies_for_ytdlp():
            return auth.cookie_file
    
    except Exception as e:
        print(f"[Selenium] General error: {e}")
    
    return None

def get_youtube_auth_status(user_data_dir):
    cookie_file = os.path.join(user_data_dir, 'youtube_cookies.txt')
    
    if not os.path.exists(cookie_file):
        return {
            "authenticated": False,
            "cookie_file_exists": False,
            "message": "No cookies found"
        }
    
    try:
        with open(cookie_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if not content.strip():
            return {
                "authenticated": False,
                "cookie_file_exists": True,
                "message": "Cookie file is empty"
            }
            
        essential_cookies = ['LOGIN_INFO', 'VISITOR_INFO1_LIVE', 'SAPISID', 'APISID']
        has_essential = any(cookie in content for cookie in essential_cookies)
        
        file_stat = os.stat(cookie_file)
        
        return {
            "authenticated": has_essential,
            "cookie_file_exists": True,
            "file_size": file_stat.st_size,
            "last_modified": file_stat.st_mtime,
            "message": "Authenticated" if has_essential else "Invalid cookies"
        }
        
    except Exception as e:
        return {
            "authenticated": False,
            "cookie_file_exists": True,
            "error": str(e),
            "message": "Error reading cookies"
        }