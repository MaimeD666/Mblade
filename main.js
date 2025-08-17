const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function startBackend() {
  // Укажите команду для запуска python.
  // Если у вас в системе установлен python в PATH, можно указать 'python' (или 'python.exe' для Windows).
  const pythonExecutable = 'python'; // или полный путь к интерпретатору, если требуется
  // Путь к вашему файлу Python-сервера (если он находится в корне, как app.py)
  const scriptPath = path.join(__dirname, 'app.py');
  
  // Запускаем сервер и наследуем stdio для вывода в консоль
  backendProcess = spawn(pythonExecutable, [scriptPath], { stdio: 'inherit' });
  
  backendProcess.on('close', (code) => {
    console.log(`Python backend завершился с кодом ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // Загружаем React‑билд (убедитесь, что папка build сформирована)
  mainWindow.loadURL(`file://${path.join(__dirname, 'build', 'index.html')}`);
  
  // При необходимости можно открыть DevTools для диагностики ошибок
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackend();  // запускаем Python-бекенд
  createWindow();  // создаем окно с React-приложением
});

app.on('window-all-closed', () => {
  // На Windows и Linux завершаем приложение при закрытии всех окон
  if (process.platform !== 'darwin') {
    app.quit();
  }
  
  // Завершаем Python сервер, если он запущен
  if (backendProcess) {
    backendProcess.kill();
  }
});

// При выходе из приложения завершаем Python сервер, если он еще работает
app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
