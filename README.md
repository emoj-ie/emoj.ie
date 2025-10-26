# emoj.ie
Website for emoj.ie

## Features

- Search and browse emojis by category
- **Advanced filtering**: Filter by emoji groups and subgroups
- **Recently used emojis**: Quick access to your most recently copied emojis
- Click any emoji to view detailed information in a modal
- Copy emojis or Unicode codes to clipboard
- Responsive design for mobile and desktop
- Offline support with service worker caching

## Running Locally

To serve this app locally on Linux, you can use Python's built-in HTTP server.

1. Navigate to the project directory:
   ```bash
   cd /path/to/emoj.ie
   ```

2. Start the server (Python 3):
   ```bash
   python3 -m http.server 8000
   ```

3. Open your browser and go to `http://localhost:8000`

If you have Python 2 instead, use:
```bash
python -m SimpleHTTPServer 8000
```

The site includes a service worker that caches the emoji data and core files for offline use.
