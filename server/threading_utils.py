import threading
import time
from contextlib import contextmanager

class TimedLock:
    """Блокировка с таймаутом для предотвращения deadlock'ов"""
    
    def __init__(self, name="UnnamedLock"):
        self._lock = threading.Lock()
        self.name = name
    
    def __enter__(self):
        """Поддержка 'with' statement"""
        acquired = self._lock.acquire(timeout=30)
        if not acquired:
            raise TimeoutError(f"Failed to acquire lock '{self.name}' within 30s")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Освобождение блокировки при выходе из 'with'"""
        self._lock.release()
    
    @contextmanager
    def acquire_timeout(self, timeout=30):
        """Контекстный менеджер с таймаутом для блокировки"""
        acquired = False
        start_time = time.time()
        
        try:
            acquired = self._lock.acquire(timeout=timeout)
            if not acquired:
                elapsed = time.time() - start_time
                raise TimeoutError(f"Failed to acquire lock '{self.name}' within {timeout}s (waited {elapsed:.2f}s)")
            yield
        finally:
            if acquired:
                self._lock.release()

# Безопасные версии существующих блокировок
youtube_cache_lock = TimedLock("youtube_cache")
current_playing_track_lock = TimedLock("current_playing_track")
queued_tracks_lock = TimedLock("queued_tracks")