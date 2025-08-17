# MBlade

Cross-platform music streaming application that integrates YouTube Music and SoundCloud services into a unified interface.

## Overview

MBlade is a desktop application built with Tauri framework, providing access to multiple music streaming platforms through a single interface. The application features audio visualization, equalizer controls, and customizable theming options.

## Features

- YouTube Music integration with authentication support
- SoundCloud service integration
- Real-time audio visualization
- 10-band equalizer with preset configurations
- Customizable user interface themes
- Track analysis and metadata display
- Playlist management and organization
- Download functionality for offline listening
- Full-screen player mode
- Media session integration

## System Requirements

- Windows 10/11 (x64)
- Internet connection for streaming services
- Audio output device

## Installation

Download the latest installer from the [Releases](https://github.com/MaimeD666/Mblade/releases) section:

- `MBlade-Setup-{version}.exe` - Windows installer package

## Technology Stack

- **Frontend**: React 18, JavaScript ES6+
- **Backend**: Python with Flask framework
- **Desktop Framework**: Tauri 2.x (Rust)
- **Audio Processing**: FFmpeg
- **Build System**: Cargo (Rust), npm (Node.js)

## Development Setup

### Prerequisites

- Node.js 16+ and npm
- Rust 1.77.2+
- Python 3.9+
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/MaimeD666/Mblade.git
cd Mblade
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
cd server
pip install -r requirements.txt
cd ..
```

4. Install Rust dependencies:
```bash
cd src-tauri
cargo build
cd ..
```

### Running in Development Mode

1. Start the Python backend server:
```bash
cd server
python app.py
```

2. Start the React development server:
```bash
npm start
```

3. Start the Tauri application:
```bash
cd src-tauri
cargo tauri dev
```

### Building for Production

```bash
npm run build
cd src-tauri
cargo tauri build
```

## Project Structure

```
MBlade/
├── src/                 # React frontend source code
├── public/              # Static assets
├── server/              # Python backend server
├── src-tauri/           # Tauri application code
├── electron-app/        # Legacy Electron build (deprecated)
└── docs/                # Documentation and assets
```

## License

Copyright © 2025 MaimeD666. All rights reserved.

## Developer

**MaimeD666**

## Contributing

This project is currently in active development. Contribution guidelines will be established in future releases.
