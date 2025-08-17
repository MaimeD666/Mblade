# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('youtube_services.py', '.'), 
        ('soundcloud_services.py', '.'), 
        ('lyrics_services.py', '.'), 
        ('threading_utils.py', '.'),
        ('chromedriver_manager.py', '.'), 
        ('setup_chromedriver.py', '.'), 
        ('chromedriver.exe', '.'),
        ('bin\\ffmpeg', 'bin\\ffmpeg')
    ],
    hiddenimports=['flask_cors', 'yt_dlp', 'selenium', 'webdriver_manager'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='BlvdeServer',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
