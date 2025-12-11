# Kilo USV Web Interface - Deployment Instructions for Away Team

**⚠️ IMPORTANT: TWO BOATS, DIFFERENT IPs**

| Boat | LAN IP | Gateway | Access URL |
|------|--------|---------|------------|
| **Boat 1** | 192.168.11.102 | 192.168.11.1 | http://192.168.11.102 |
| **Boat 2** | 192.168.12.102 | 192.168.12.1 | http://192.168.12.102 |

**Credentials (both boats):** username: `pi` / password: `un*****d9`  
**What we're deploying:** USV Control Dashboard (https://github.com/isensystech/KiloWebInterface)

---

## Quick Start Overview
1. Prepare fresh SD card with Raspberry Pi OS
2. Connect Pi to network
3. SSH into the Pi
4. Clone and install the application
5. Set it up to run on boot
6. Access the web interface

---

## Step 1: Prepare the Raspberry Pi

### Option A: If starting with a fresh SD card

1. **Download Raspberry Pi Imager** on your laptop:
   - Go to: https://www.raspberrypi.com/software/
   - Install Raspberry Pi Imager

2. **Flash the SD Card:**
   - Insert SD card into your computer
   - Open Raspberry Pi Imager
   - Click "Choose OS" → Select "Raspberry Pi OS (64-bit)" (recommended)
   - Click "Choose Storage" → Select your SD card
   - Click the GEAR ICON (⚙️) to configure settings:
     - Set hostname: `kilo-usv` (or whatever you prefer)
     - **Enable SSH** ✓ Use password authentication
     - Set username: `pi`
     - Set password: `un******d9`
     - Configure wireless LAN (if needed):
       - SSID: [your wifi name]
       - Password: [your wifi password]
       - Country: US (or your country)
   - Click "Save" then "Write"
   - Wait for it to complete (~5-10 minutes)

3. **Boot the Pi:**
   - Insert SD card into the Raspberry Pi
   - Connect power, Ethernet cable to LAN port
   - Wait 1-2 minutes for first boot

### Option B: If Pi is already set up
- Skip to Step 2

---

## Step 2: Configure Static IP on LAN Port

**CRITICAL:** The Ethernet (LAN) port must have a static IP for vessel control. Each boat gets a different IP on a different subnet. WiFi will be used for Starlink internet.

| Boat | LAN IP | Gateway |
|------|--------|---------|
| Boat 1 | 192.168.11.102/24 | 192.168.11.1 |
| Boat 2 | 192.168.12.102/24 | 192.168.12.1 |

### Initial Connection (via WiFi or hostname)

```bash
# Connect via hostname (if WiFi is configured)
ssh pi@kilo-usv.local

# OR scan network to find Pi
# Mac/Linux: arp -a | grep -i "b8:27:eb\|dc:a6:32"
# Windows: arp -a | findstr "b8-27-eb dc-a6-32"

# Password: un****ed9
```

### Set Static IP on eth0

**Choose the configuration for YOUR boat:**

#### BOAT 1 Configuration

```bash
# Add static IP configuration for eth0 (LAN port) - BOAT 1
sudo tee -a /etc/dhcpcd.conf > /dev/null <<'EOF'

# Static IP for eth0 (LAN port) - BOAT 1 - Vessel Control Network
interface eth0
static ip_address=192.168.11.102/24
static routers=192.168.11.1
static domain_name_servers=192.168.11.1 8.8.8.8
EOF

# Apply changes
sudo systemctl restart dhcpcd

# Wait a few seconds for network to reconfigure
sleep 5

# Verify the new IP
ip addr show eth0 | grep "inet "
# Should show: inet 192.168.11.102/24
```

**Exit and reconnect via static IP:**

```bash
# Exit current SSH session
exit

# Reconnect using the new static IP
ssh pi@192.168.11.102
# Password: un*****ed9
```

---

#### BOAT 2 Configuration

```bash
# Add static IP configuration for eth0 (LAN port) - BOAT 2
sudo tee -a /etc/dhcpcd.conf > /dev/null <<'EOF'

# Static IP for eth0 (LAN port) - BOAT 2 - Vessel Control Network
interface eth0
static ip_address=192.168.12.102/24
static routers=192.168.12.1
static domain_name_servers=192.168.12.1 8.8.8.8
EOF

# Apply changes
sudo systemctl restart dhcpcd

# Wait a few seconds for network to reconfigure
sleep 5

# Verify the new IP
ip addr show eth0 | grep "inet "
# Should show: inet 192.168.12.102/24
```

**Exit and reconnect via static IP:**

```bash
# Exit current SSH session
exit

# Reconnect using the new static IP
ssh pi@192.168.12.102
# Password: un*******d9
```

---

## Step 3: Connect to the Raspberry Pi

From now on, always connect via the static LAN IP:

**For Boat 1:**
```bash
ssh pi@192.168.11.102
```

**For Boat 2:**
```bash
ssh pi@192.168.12.102
```

**When prompted:**
- Enter password: `un*****d9`

---

## Step 4: Install Dependencies on the Pi

Once you're logged into the Pi via SSH (at 192.168.11.102 or 192.168.12.102), run these commands:

```bash
# Update the system
sudo apt update
sudo apt upgrade -y

# Install Python 3 and pip (should already be installed on newer Pi OS)
sudo apt install -y python3 python3-pip python3-venv git

# Install system dependencies that might be needed
sudo apt install -y build-essential
```

---

## Step 5: Clone and Install the Application

```bash
# Go to home directory
cd ~

# Clone the repository
git clone https://github.com/isensystech/KiloWebInterface.git

# Enter the project directory
cd KiloWebInterface

# Create a Python virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install Python dependencies
pip install fastapi uvicorn

# Optional: If there's a requirements.txt file
pip install -r requirements.txt
```

---

## Step 6: Test the Application

```bash
# Make sure you're in the KiloWebInterface directory
cd ~/KiloWebInterface

# Activate virtual environment (if not already active)
source .venv/bin/activate

# Run the application
python app.py
```

**You should see output like:**
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:5000
```

**Test it from your laptop:**
- Open a web browser
- Go to:
  - Boat 1: `http://192.168.11.102:5000`
  - Boat 2: `http://192.168.12.102:5000`
- You should see the Kilo USV Control Dashboard

**To stop the test:** Press `Ctrl+C` in the SSH terminal

---

## Step 7: Set Up nginx for Port 80 Access

nginx will act as a reverse proxy, allowing access to the dashboard on port 80 (standard HTTP) instead of requiring :5000.

```bash
# Install nginx (if not already installed)
sudo apt install -y nginx

# Create nginx configuration for the Kilo web interface
sudo tee /etc/nginx/sites-available/kilo-web > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable the site and disable the default nginx page
sudo ln -sf /etc/nginx/sites-available/kilo-web /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# If test passes, restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

**Test nginx setup:**
- Open browser on your laptop
- Go to:
  - Boat 1: `http://192.168.11.102` (no port number needed!)
  - Boat 2: `http://192.168.12.102` (no port number needed!)
- You should see the Kilo USV Control Dashboard

---

## Step 8: Set Up Auto-Start on Boot

To make the application run automatically when the Pi boots:

```bash
# Create a systemd service file
sudo nano /etc/systemd/system/kilo-web.service
```

**Paste this content into the file:**
```ini
[Unit]
Description=Kilo USV Web Interface
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/KiloWebInterface
Environment="PATH=/home/pi/KiloWebInterface/.venv/bin"
ExecStart=/home/pi/KiloWebInterface/.venv/bin/python app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

**Enable and start the service:**
```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable kilo-web.service

# Start the service now
sudo systemctl start kilo-web.service

# Check if it's running
sudo systemctl status kilo-web.service
```

**You should see:** `Active: active (running)`

---

## Step 9: Verify Everything Works

1. **Test the web interface:**
   - Open browser on your laptop
   - Go to:
     - Boat 1: `http://192.168.11.102` (no port needed!)
     - Boat 2: `http://192.168.12.102` (no port needed!)
   - Verify the dashboard loads

2. **Check both services are running:**
   ```bash
   sudo systemctl status kilo-web.service
   sudo systemctl status nginx
   ```
   Both should show: `Active: active (running)`

3. **Verify correct IP configuration:**
   ```bash
   ip addr show eth0 | grep "inet "
   # Boat 1 should show: inet 192.168.11.102/24
   # Boat 2 should show: inet 192.168.12.102/24
   ```

4. **Test auto-start:**
   ```bash
   # Reboot the Pi
   sudo reboot
   ```
   - Wait 1-2 minutes
   - Try accessing the dashboard URL again
   - It should work automatically!

---

## Troubleshooting

### Can't SSH into the Pi?
- Verify Pi is powered on (LED lights?)
- Check network cable is connected OR WiFi is configured
- Try pinging:
  - Boat 1: `ping 192.168.11.102`
  - Boat 2: `ping 192.168.12.102`
- Try hostname: `ssh pi@kilo-usv.local`

### Application won't start?
```bash
# Check the service status
sudo systemctl status kilo-web.service

# Check the logs
sudo journalctl -u kilo-web.service -n 50

# Manually test
cd ~/KiloWebInterface
source .venv/bin/activate
python app.py
```

### nginx issues?
```bash
# Check nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Check nginx error log
sudo tail -20 /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### Port 80 already in use?
```bash
# See what's using port 80
sudo netstat -tlnp | grep :80

# If Apache is running, disable it
sudo systemctl stop apache2
sudo systemctl disable apache2
sudo systemctl restart nginx
```

### Can't access web interface?
- Verify Pi is on same network as your laptop
- Try direct access to app:
  - Boat 1: `http://192.168.11.102:5000`
  - Boat 2: `http://192.168.12.102:5000`
- Check firewall on Pi (shouldn't be an issue by default)
- Verify both services are running:
  ```bash
  sudo systemctl status kilo-web.service
  sudo systemctl status nginx
  ```
- Test from the Pi itself: `curl http://127.0.0.1:5000`

### Need to update the application?
```bash
cd ~/KiloWebInterface
git pull
sudo systemctl restart kilo-web.service
```

---

## Quick Reference Commands

```bash
# Start the services
sudo systemctl start kilo-web.service
sudo systemctl start nginx

# Stop the services
sudo systemctl stop kilo-web.service
sudo systemctl stop nginx

# Restart the services
sudo systemctl restart kilo-web.service
sudo systemctl restart nginx

# Check service status
sudo systemctl status kilo-web.service
sudo systemctl status nginx

# View application logs (last 50 lines)
sudo journalctl -u kilo-web.service -n 50

# View application logs (live follow)
sudo journalctl -u kilo-web.service -f

# View nginx error log
sudo tail -20 /var/log/nginx/error.log

# Test nginx configuration
sudo nginx -t

# Update the code from GitHub
cd ~/KiloWebInterface
git pull
sudo systemctl restart kilo-web.service
```

---

## Network Configuration

**Dual Network Architecture:**

The Pi is configured with two network interfaces for each boat:

### Boat 1

**eth0 (LAN/Ethernet Port)**
- **Purpose:** Vessel control network
- **Configuration:** Static IP
- **IP Address:** `192.168.11.102/24`
- **Gateway:** `192.168.11.1`
- **DNS:** `192.168.11.1`, `8.8.8.8`
- **Use:** CAN bridge communication, local dashboard access, vessel controls

**wlan0 (WiFi)**
- **Purpose:** Internet connectivity
- **Configuration:** DHCP from Starlink
- **Use:** Software updates, remote monitoring, GitHub access

### Boat 2

**eth0 (LAN/Ethernet Port)**
- **Purpose:** Vessel control network
- **Configuration:** Static IP
- **IP Address:** `192.168.12.102/24`
- **Gateway:** `192.168.12.1`
- **DNS:** `192.168.12.1`, `8.8.8.8`
- **Use:** CAN bridge communication, local dashboard access, vessel controls

**wlan0 (WiFi)**
- **Purpose:** Internet connectivity
- **Configuration:** DHCP from Starlink
- **Use:** Software updates, remote monitoring, GitHub access

---

**Access URLs:**
- Boat 1 Dashboard: `http://192.168.11.102` (port 80 via nginx)
- Boat 1 Direct backend: `http://192.168.11.102:5000` (FastAPI)
- Boat 2 Dashboard: `http://192.168.12.102` (port 80 via nginx)
- Boat 2 Direct backend: `http://192.168.12.102:5000` (FastAPI)

**Why this setup?**
- Static LAN IP ensures reliable vessel control (never changes)
- WiFi provides internet without affecting control network
- Separation between control network and internet for safety
- **Each boat on separate subnet prevents IP conflicts**

**To verify network configuration:**
```bash
# Check LAN IP
ip addr show eth0 | grep "inet "
# Boat 1 should show: inet 192.168.11.102/24
# Boat 2 should show: inet 192.168.12.102/24

# Check WiFi IP (will vary)
ip addr show wlan0 | grep "inet "

# Check all IPs
hostname -I
```

---

## Summary Checklist

- [ ] **Identified which boat** (Boat 1 = 192.168.11.102, Boat 2 = 192.168.12.102)
- [ ] SD card flashed with Raspberry Pi OS (WiFi configured for Starlink)
- [ ] Pi connected to network (Ethernet cable plugged in + WiFi)
- [ ] Initial SSH connection successful
- [ ] Static IP configured on eth0 (correct IP for the boat)
- [ ] Reconnected via static IP
- [ ] Git repository cloned
- [ ] Python dependencies installed
- [ ] nginx installed and configured
- [ ] Application tested manually
- [ ] Systemd service created and enabled
- [ ] nginx service enabled and running
- [ ] Auto-start verified after reboot
- [ ] Web interface accessible at correct URL
- [ ] Network configuration verified (eth0 = correct static IP, wlan0 = Starlink DHCP)

---

## Need Help?

Contact Scott with:
- What step you're on
- Error messages (exact text if possible)
- Output from: `sudo systemctl status kilo-web.service`

**Good luck with the deployment! 🚢**
