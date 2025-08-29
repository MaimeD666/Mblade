# -*- mode: python ; coding: utf-8 -*-


block_cipher = None


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('youtube_services.py', '.'), 
        ('soundcloud_services.py', '.'),
        ('yandex_music_services.py', '.'),
        ('lyrics_services.py', '.'), 
        ('threading_utils.py', '.'),
        ('chromedriver_manager.py', '.'), 
        ('setup_chromedriver.py', '.'), 
        ('chromedriver.exe', '.'),
        ('soundcloud_auth.py', '.'),
        ('youtube_auth.py', '.'),
        ('music_tag_dictionary.json', '.'),
        ('bin\\ffmpeg', 'bin\\ffmpeg')
    ],
    hiddenimports=['flask_cors', 'yt_dlp', 'selenium', 'webdriver_manager', 'yandex_music', 'soundcloud_services', 'yandex_music_services', 'youtube_services'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MusicAppServer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
