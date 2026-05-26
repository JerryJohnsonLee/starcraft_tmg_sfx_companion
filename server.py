import http.server
import socketserver
import sys

PORT = 8000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for seamless local developer iterations
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

# Explicitly register MIME mappings to avoid Windows registry issues
CustomHTTPRequestHandler.extensions_map.update({
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
})

# Prevent address already in use errors on restart
socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"StarCraft TMG SFX Server started at http://localhost:{PORT}")
        print("MIME maps updated explicitly, cache disabled.")
        sys.stdout.flush()
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer shutting down.")
except Exception as e:
    print(f"Error starting server: {e}")
