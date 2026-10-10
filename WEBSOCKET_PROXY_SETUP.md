# Complete WebSocket & Reverse Proxy Configuration Guide
### Multi-Domain Architecture:
* **Frontend Domain**: `https://hrms.gndeveloper.cloud`
* **Backend API & WebSockets**: `https://hrmsback.gndeveloper.cloud`

---

## 1. Frontend `.env` File (`HRMSfront/.env`)

Since your backend runs on `https://hrmsback.gndeveloper.cloud`, your frontend `.env` must point to the backend domain:

```env
SKIP_PREFLIGHT_CHECK=true
HOST=127.0.0.1
PORT=8579
DANGEROUSLY_DISABLE_HOST_CHECK=true

# Point to the BACKEND domain:
REACT_APP_API_URL=https://hrmsback.gndeveloper.cloud/api
REACT_APP_SOCKET_URL=https://hrmsback.gndeveloper.cloud
```

Then rebuild the frontend:
```bash
cd HRMSfront
npm run build
```

---

## 2. Nginx Configuration for BACKEND (`hrmsback.gndeveloper.cloud`)

This is the configuration file for your **backend server block** (e.g. `/etc/nginx/sites-available/hrmsback.gndeveloper.cloud`):

```nginx
# ===================================================================
# NGINX BACKEND & WEBSOCKET CONFIG (hrmsback.gndeveloper.cloud)
# ===================================================================

server {
    listen 80;
    server_name hrmsback.gndeveloper.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hrmsback.gndeveloper.cloud;

    ssl_certificate /etc/letsencrypt/live/hrmsback.gndeveloper.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hrmsback.gndeveloper.cloud/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;

    # ---------------------------------------------------------------
    # 1. WEBSOCKET / SOCKET.IO: Critical for Live Screen Monitoring
    # ---------------------------------------------------------------
    location /socket.io/ {
        proxy_pass http://127.0.0.1:9410;
        proxy_http_version 1.1;

        # Upgrade to WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for low-latency live streaming
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;

        # Long timeout so connections don't drop during active monitoring
        proxy_connect_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_read_timeout 86400s;
    }

    # ---------------------------------------------------------------
    # 2. REST API & GENERAL BACKEND REQUESTS
    # ---------------------------------------------------------------
    location / {
        proxy_pass http://127.0.0.1:9410;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Apply Nginx Changes:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. Apache VirtualHost for BACKEND (`hrmsback.gndeveloper.cloud`)

If your backend server runs Apache:

```apache
<VirtualHost *:80>
    ServerName hrmsback.gndeveloper.cloud
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>

<VirtualHost *:443>
    ServerName hrmsback.gndeveloper.cloud

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/hrmsback.gndeveloper.cloud/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/hrmsback.gndeveloper.cloud/privkey.pem

    # Enable WebSocket Proxying
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:9410/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /(.*)           http://127.0.0.1:9410/$1 [P,L]

    ProxyRequests Off
    ProxyPreserveHost On

    # 1. Socket.IO WebSocket pass
    ProxyPass /socket.io/ ws://127.0.0.1:9410/socket.io/
    ProxyPassReverse /socket.io/ ws://127.0.0.1:9410/socket.io/

    # 2. Main API & Static pass
    ProxyPass / http://127.0.0.1:9410/
    ProxyPassReverse / http://127.0.0.1:9410/
</VirtualHost>
```

---

## 4. Desktop Agent App Configuration

Ensure the desktop monitoring agent installed on employee computers is pointing to the backend domain:
* **Server URL**: `https://hrmsback.gndeveloper.cloud`
