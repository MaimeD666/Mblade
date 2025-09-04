# MBlade

Decentralized music streaming application that operates locally. Integrates YouTube Music and SoundCloud through local service proxies.

## Overview

MBlade is a desktop music application built with Tauri framework that provides local access to streaming platforms without relying on external servers. All processing, authentication, and data handling occurs locally on the user's machine, ensuring complete privacy and independence from cloud services.

## Key Features

- **Fully Local Operation**: No external servers or cloud dependencies
- **Decentralized Architecture**: All data processing occurs on user's machine
- **YouTube Music Integration**: Local authentication and streaming proxy
- **SoundCloud Support**: Direct API integration with user-provided credentials
- **Real-time Audio Visualization**: Advanced frequency analysis and visual effects
- **10-band Equalizer**: Professional audio processing with preset configurations
- **Track Analysis**: Local metadata extraction and audio fingerprinting
- **Playlist Management**: Local storage and organization
- **Download Functionality**: Local caching for offline playback
- **Custom Themes**: User-configurable interface styling
- **Media Controls**: System-level media session integration

## System Requirements

- Windows 10/11 (64-bit)
- 4GB RAM minimum
- 1GB free disk space
- Audio output device
- Internet connection (for streaming content only)

## Installation

Download the latest release from the [Releases](https://github.com/MaimeD666/Mblade/releases) page:

- `MBlade-Setup-{version}.exe` - Windows installer

## Technology Stack

- **Frontend**: React 18.2, JavaScript ES6+
- **Backend**: Python 3.9+ with Flask
- **Audio Processing**: FFmpeg
- **Build Tools**: npm

## Development

### Prerequisites

- Node.js 16+
- Python 3.9+
- Git

### Setup

1. Clone repository:
```bash
git clone git@github.com:MaimeD666/Mblade.git  # use SSH
cd Mblade
```

2. Install dependencies:
```bash
npm install
cd server && pip install -r requirements.txt && cd ..
```

3. Development mode:
```bash
# Terminal 1: Backend server
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
cd server && python app.py >backend.log 2>&1 &  # run in background
cd .. && npm start
```

## Project Structure

```
MBlade/
├── src/                 # React frontend components
├── public/              # Static assets and resources
├── server/              # Python backend server
└── package.json         # Project configuration
```

## Configuration

The application requires local configuration for:
- SoundCloud Client ID (user-provided)
- YouTube authentication (local OAuth flow)
- Audio device selection
- Theme preferences

All configuration is stored locally in the application data directory.

## License

Proprietary software. All rights reserved.

## Author

MaimeD666
