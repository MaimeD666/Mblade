"""
Тестирование YouTube авторизации с новой системой ChromeDriver
"""

import os
import sys
from youtube_auth import YouTubeSeleniumAuth, get_youtube_auth_status

def test_chromedriver_setup():
    """Тест настройки ChromeDriver"""
    print("=== Testing ChromeDriver Setup ===")
    
    try:
        from chromedriver_manager import ensure_chromedriver_ready
        
        # Принудительно запускаем настройку
        chromedriver_path = ensure_chromedriver_ready()
        
        if chromedriver_path:
            print(f"ChromeDriver ready at: {chromedriver_path}")
            print(f"File exists: {os.path.exists(chromedriver_path)}")
            return True
        else:
            print("Failed to ensure ChromeDriver readiness")
            return False
        
    except Exception as e:
        print(f"Error ensuring ChromeDriver readiness: {e}")
        return False

def test_youtube_auth_initialization():
    """Тест инициализации YouTube авторизации"""
    print("\n=== Testing YouTube Auth Initialization ===")
    
    try:
        # Создаем временную папку для тестирования
        test_user_data_dir = os.path.join(os.path.dirname(__file__), 'test_user_data')
        os.makedirs(test_user_data_dir, exist_ok=True)
        
        # Инициализируем авторизацию
        auth = YouTubeSeleniumAuth(test_user_data_dir, headless=True)
        
        # Проверяем получение пути к ChromeDriver
        chromedriver_path = auth.get_chromedriver_path()
        
        if chromedriver_path:
            print(f"ChromeDriver path obtained: {chromedriver_path}")
            print(f"ChromeDriver exists: {os.path.exists(chromedriver_path)}")
            return True
        else:
            print("Failed to get ChromeDriver path")
            return False
            
    except Exception as e:
        print(f"Error initializing YouTube auth: {e}")
        return False

def test_driver_setup():
    """Тест настройки Selenium WebDriver"""
    print("\n=== Testing Selenium WebDriver Setup ===")
    
    try:
        test_user_data_dir = os.path.join(os.path.dirname(__file__), 'test_user_data')
        os.makedirs(test_user_data_dir, exist_ok=True)
        
        auth = YouTubeSeleniumAuth(test_user_data_dir, headless=True)
        
        if auth.setup_driver():
            print("WebDriver setup successful!")
            
            # Тестируем простой запрос
            if auth.driver:
                auth.driver.get('https://www.google.com')
                title = auth.driver.title
                print(f"Test page title: {title}")
                
                auth.driver.quit()
                return True
        else:
            print("WebDriver setup failed")
            return False
            
    except Exception as e:
        print(f"Error setting up WebDriver: {e}")
        return False

def test_auth_status():
    """Тест проверки статуса авторизации"""
    print("\n=== Testing Auth Status ===")
    
    try:
        test_user_data_dir = os.path.join(os.path.dirname(__file__), 'test_user_data')
        status = get_youtube_auth_status(test_user_data_dir)
        
        print(f"Auth status: {status}")
        return True
        
    except Exception as e:
        print(f"Error getting auth status: {e}")
        return False

def cleanup_test_data():
    """Очистка тестовых данных"""
    try:
        import shutil
        test_user_data_dir = os.path.join(os.path.dirname(__file__), 'test_user_data')
        if os.path.exists(test_user_data_dir):
            shutil.rmtree(test_user_data_dir)
            print("Test data cleaned up")
    except Exception as e:
        print(f"Error cleaning up test data: {e}")

def main():
    print("YouTube Authentication System Test")
    print("=" * 50)
    
    tests = [
        ("ChromeDriver Setup", test_chromedriver_setup),
        ("YouTube Auth Initialization", test_youtube_auth_initialization),
        ("Selenium WebDriver Setup", test_driver_setup),
        ("Auth Status Check", test_auth_status)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            print(f"[PASS] {test_name}: {'PASS' if result else 'FAIL'}")
        except Exception as e:
            results.append((test_name, False))
            print(f"[ERROR] {test_name}: ERROR - {e}")
    
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("[SUCCESS] All tests passed! YouTube authentication system is ready.")
    else:
        print("[WARNING] Some tests failed. Please check the errors above.")
    
    cleanup_test_data()
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)