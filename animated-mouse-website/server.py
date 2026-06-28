import http.server
import socketserver
import os
import sys

PORT = 8000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and caching headers for faster local reloads
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

# Change directory to the script's directory to ensure correct file serving paths
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Attempt to bind to PORT, incrementing automatically if port is already in use
while True:
    try:
        handler = MyHandler
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            print(f"\n=============================================")
            print(f"  SCROLL ANIMATION SERVER RUNNING SUCCESSFULLY")
            print(f"=============================================")
            print(f"  Access local application at:")
            print(f"  -> http://localhost:{PORT}")
            print(f"  -> http://127.0.0.1:{PORT}")
            print(f"=============================================\n")
            print("Press Ctrl+C in terminal to stop server execution.")
            sys.stdout.flush()
            httpd.serve_forever()
    except OSError:
        PORT += 1
    except KeyboardInterrupt:
        print("\nStopping server...")
        sys.exit(0)
