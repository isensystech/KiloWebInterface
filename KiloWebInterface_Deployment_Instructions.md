# COMPLETE DEPLOYMENT GUIDE - BOAT 1
## Raspberry Pi Web Interface - From Blank SD Card to Working System

**Boat Configuration:**
- Boat Number: **1**
- LAN IP: **192.168.11.102/24**
- Gateway: **192.168.11.1**
- ROS Bridge IP: **192.168.11.101**
- WiFi: Starlink (for internet access during setup)

---

## 📦 WHAT YOU NEED

- [ ] Raspberry Pi 4 (4GB+ recommended)
- [ ] MicroSD card (16GB+)
- [ ] Computer with SD card reader
- [ ] Ethernet cable (to connect to boat network 192.168.11.X)
- [ ] Starlink WiFi access (for downloads during setup)

---

## STEP 1: FLASH SD CARD

### Using Raspberry Pi Imager

1. **Download Raspberry Pi Imager:**
   - https://www.raspberrypi.com/software/

2. **Configure the Image:**
   - OS: **Raspberry Pi OS (64-bit)** (Debian Bookworm)
   - Storage: Your SD card
   
3. **Click the Gear Icon (⚙️) for Advanced Options:**

   **General Tab:**
   - Hostname: `hp1-usv` (or `kilo-usv`)
   - Enable SSH: ✅ Use password authentication
   - Username: `pi`
   - Password: `unmanned9`
   - Configure wireless LAN: ✅
     - SSID: `[Your Starlink WiFi SSID]`
     - Password: `[Your Starlink WiFi Password]`
     - Country: `US`
   - Set locale: ✅ America/Los_Angeles, US keyboard

4. **Write the Image**
   - Click "Write" and wait for completion

5. **Insert SD card into Raspberry Pi and power on**

---

## STEP 2: INITIAL CONNECTION

### Option A: Connect via WiFi (Recommended for initial setup)

Wait 2-3 minutes for Pi to boot and connect to Starlink WiFi.

```bash
# From your computer on same Starlink WiFi
ssh pi@hp1-usv.local
# Password: unmanned9
```

If `.local` doesn't work, find the IP:
```bash
# Check your router's DHCP leases, or use:
ping hp1-usv.local
# Then: ssh pi@[the-ip-address]
```

### Option B: Connect via Ethernet

If you have a monitor and keyboard, or want to connect directly via ethernet from your computer, connect and login locally.

---

## STEP 3: CONFIGURE STATIC IP ON ETH0

Once connected via WiFi/SSH:

```bash
# Verify you're connected
ip addr show wlan0 | grep "inet "
# Should show Starlink DHCP address

# Now configure static IP on eth0 for boat LAN
sudo tee -a /etc/dhcpcd.conf > /dev/null <<'EOF'

# Boat 1 Static IP Configuration
interface eth0
static ip_address=192.168.11.102/24
static routers=192.168.11.1
static domain_name_servers=192.168.11.1 8.8.8.8
EOF

# Restart networking
sudo systemctl restart dhcpcd

# IMPORTANT: You'll lose SSH connection if connected via ethernet
# Reconnect to the new static IP or continue via WiFi
```

### Verify Configuration

```bash
# Check eth0 has static IP
ip addr show eth0 | grep "inet "
# Should show: inet 192.168.11.102/24

# Check WiFi still has internet
ip addr show wlan0 | grep "inet "
# Should show: inet [Starlink DHCP IP]

# Test internet access
ping -c 3 8.8.8.8

# Check default route uses WiFi for internet
ip route
# Default should go through wlan0
```

---

## STEP 4: INSTALL DEPENDENCIES

```bash
# Update package lists
sudo apt update

# Install required packages
sudo apt install -y python3 python3-venv python3-pip git nginx

# Verify installations
python3 --version  # Should be 3.11+
git --version
nginx -v
```

---

## STEP 5: CLONE KILOWEBINTERFACE

```bash
# Navigate to home directory
cd ~

# Clone the repository on the version/map branch
git clone -b version/map https://github.com/isensystech/KiloWebInterface.git

# Verify branch
cd ~/KiloWebInterface
git branch
# Should show: * version/map

# Check we have the files
ls -la
# Should see: app.py, static/, templates/, requirements.txt
```

---

## STEP 6: SET UP PYTHON VIRTUAL ENVIRONMENT

```bash
cd ~/KiloWebInterface

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install websockets first (required for uvicorn WebSocket support)
pip install websockets

# Install requirements
pip install -r requirements.txt

# Install FastAPI and uvicorn explicitly
pip install fastapi uvicorn

# Verify installations
pip list | grep -E "fastapi|uvicorn|websockets"

# Should show:
# fastapi        0.124.2 (or similar)
# uvicorn        0.38.0 (or similar)
# websockets     15.0.1 (or similar)

# Deactivate for now
deactivate
```

---

## STEP 7: CREATE SYSTEMD SERVICE

```bash
# Create the service file
sudo tee /etc/systemd/system/kilo-web.service > /dev/null <<'EOF'
[Unit]
Description=Kilo USV Web Interface
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/KiloWebInterface
ExecStart=/home/pi/KiloWebInterface/.venv/bin/python app.py
Restart=always
RestartSec=10
Environment="PATH=/home/pi/KiloWebInterface/.venv/bin"
Environment="KILO_CONTROL_WHITELIST=192.168.11.101,127.0.0.1"

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable kilo-web.service

# Start the service
sudo systemctl start kilo-web.service

# Check status
sudo systemctl status kilo-web.service

# Should show: Active: active (running)

# Check logs
sudo journalctl -u kilo-web.service -n 20

# Should see: "Starting Kilo UI server at 0.0.0.0:5000"
```

---

## STEP 8: CONFIGURE NGINX REVERSE PROXY

```bash
# Create nginx site configuration
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

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable kilo-web site
sudo ln -sf /etc/nginx/sites-available/kilo-web /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Should show: syntax is ok, test is successful

# Restart nginx
sudo systemctl restart nginx

# Enable nginx to start on boot
sudo systemctl enable nginx

# Check nginx status
sudo systemctl status nginx

# Should show: Active: active (running)
```

---

## STEP 9: VERIFY INSTALLATION

### Check Services

```bash
# Both should be active (running)
sudo systemctl status kilo-web.service
sudo systemctl status nginx

# Check listening ports
ss -tulpn | grep -E ":80|:5000"

# Should show:
# *:80    (nginx)
# *:5000  (python/uvicorn)
```

### Test Web Interface

```bash
# Test from Pi itself
curl -I http://localhost

# Should show: HTTP/1.1 200 OK

# Test on LAN IP
curl -I http://192.168.11.102

# Should show: HTTP/1.1 200 OK
```

### Test from Your Computer

**On the boat network (192.168.11.X):**
- Open browser
- Navigate to: **http://192.168.11.102**
- Should see Kilo USV Web Interface!

---

## STEP 10: VERIFY NETWORK CONFIGURATION

```bash
# Show both interfaces
ip addr show

# Check eth0 (Boat LAN)
ip addr show eth0
# Should show: 192.168.11.102/24

# Check wlan0 (Starlink WiFi)  
ip addr show wlan0
# Should show: inet [Starlink DHCP IP]

# Check routing table
ip route
# Default route should go through wlan0 for internet

# Test boat LAN connectivity
ping -c 3 192.168.11.1

# Test internet connectivity
ping -c 3 google.com
```

---

## STEP 11: FINAL VERIFICATION

### Check Environment Variables

```bash
# Verify KILO_CONTROL_WHITELIST is set
sudo systemctl show kilo-web.service | grep KILO_CONTROL_WHITELIST

# Should show:
# Environment=KILO_CONTROL_WHITELIST=192.168.11.101,127.0.0.1
```

### Check Logs

```bash
# Check kilo-web logs
sudo journalctl -u kilo-web.service -n 30

# Look for:
# ✅ "Starting Kilo UI server at 0.0.0.0:5000"
# ✅ No errors
# ✅ When ROS bridge connects: "192.168.11.101:X - WebSocket /ws [accepted]"

# Check nginx logs
sudo journalctl -u nginx -n 20

# Look for:
# ✅ No errors
```

### Test WebSocket Connections

Once ROS bridge at 192.168.11.101 is running:

```bash
# Watch for ROS bridge connections in real-time
sudo journalctl -u kilo-web.service -f

# You should see:
# 192.168.11.101:X - "WebSocket /ws" [accepted]
# connection open
```

---

## 📋 DEPLOYMENT CHECKLIST

**Hardware Setup:**
- [ ] SD card flashed with Raspberry Pi OS
- [ ] WiFi configured for Starlink
- [ ] Pi powered on and booted
- [ ] SSH connection established

**Network Configuration:**
- [ ] Static IP configured on eth0: 192.168.11.102
- [ ] WiFi (wlan0) has internet via Starlink
- [ ] Can ping boat gateway: 192.168.11.1
- [ ] Can ping internet: google.com

**Software Installation:**
- [ ] System updated (apt update)
- [ ] Dependencies installed (python3, git, nginx)
- [ ] KiloWebInterface cloned (version/map branch)
- [ ] Python venv created
- [ ] Requirements installed (including websockets)

**Service Configuration:**
- [ ] systemd service created: kilo-web.service
- [ ] KILO_CONTROL_WHITELIST set: 192.168.11.101,127.0.0.1
- [ ] Service enabled and running
- [ ] nginx configured as reverse proxy
- [ ] nginx enabled and running

**Verification:**
- [ ] Service status shows active (running)
- [ ] Port 80 accessible: http://192.168.11.102
- [ ] Web interface loads in browser
- [ ] No errors in service logs
- [ ] Environment variable set correctly

**Integration (when ROS bridge is ready):**
- [ ] ROS bridge connects from 192.168.11.101
- [ ] WebSocket connection accepted
- [ ] Gamepad controls reach ROS bridge
- [ ] Boat responds to commands

---

## 🔧 TROUBLESHOOTING

### Service Won't Start

```bash
# Check logs for errors
sudo journalctl -u kilo-web.service -n 50

# Check if port 5000 is already in use
sudo lsof -i :5000

# Check file permissions
ls -la /home/pi/KiloWebInterface/

# Try running manually
cd /home/pi/KiloWebInterface
source .venv/bin/activate
python app.py
# Check for errors
```

### Can't Access Web Interface

```bash
# Check if nginx is running
sudo systemctl status nginx

# Check if backend is running
sudo systemctl status kilo-web.service

# Check firewall (should be off by default)
sudo ufw status

# Test local connection
curl -I http://localhost
curl -I http://192.168.11.102
```

### WebSocket Errors in Browser Console

```bash
# Check if websockets package is installed
/home/pi/KiloWebInterface/.venv/bin/pip list | grep websockets

# If missing:
cd /home/pi/KiloWebInterface
source .venv/bin/activate
pip install websockets
deactivate
sudo systemctl restart kilo-web.service
```

### No Connection from ROS Bridge

```bash
# Verify environment variable is set
sudo systemctl show kilo-web.service | grep KILO

# Check logs when ROS bridge tries to connect
sudo journalctl -u kilo-web.service -f

# Verify ROS bridge is trying to connect to correct IP
# (check on ROS bridge at 192.168.11.101)
```

---

## 🚀 QUICK COMMANDS REFERENCE

### Check Status
```bash
sudo systemctl status kilo-web.service nginx
```

### View Logs
```bash
sudo journalctl -u kilo-web.service -n 50
sudo journalctl -u kilo-web.service -f  # Follow mode
```

### Restart Services
```bash
sudo systemctl restart kilo-web.service
sudo systemctl restart nginx
```

### Update Code (when changes pushed to GitHub)
```bash
cd ~/KiloWebInterface
git pull origin version/map
sudo systemctl restart kilo-web.service
```

### Network Info
```bash
ip addr show
ip route
ss -tulpn | grep -E ":80|:5000"
```

---

## 📝 IMPORTANT NOTES

**Dual Network Setup:**
- **eth0 (192.168.11.102)**: Boat control network, static IP
- **wlan0 (Starlink)**: Internet access, DHCP

**Why This Works:**
- Linux routing prioritizes default route through wlan0 for internet
- eth0 handles local boat network traffic (192.168.11.X)
- This allows simultaneous internet access and boat control

**Security Note:**
- KILO_CONTROL_WHITELIST only allows connections from:
  - 192.168.11.101 (ROS bridge)
  - 127.0.0.1 (localhost)
- All other IPs must authenticate via browser login

**Port Configuration:**
- Backend runs on: 5000 (internal)
- nginx proxies to: 80 (external)
- Users access via: http://192.168.11.102 (port 80)

---

## ⏱️ ESTIMATED TIME

- **SD Card Flashing**: 5-10 minutes
- **Initial Boot & Updates**: 5-10 minutes
- **Software Installation**: 10-15 minutes
- **Configuration**: 5-10 minutes
- **Testing**: 5 minutes

**Total**: ~30-45 minutes per Pi

---

## 🎯 SUCCESS CRITERIA

**You're done when:**
1. ✅ Browser loads http://192.168.11.102
2. ✅ Web interface displays boat controls
3. ✅ Both services show active (running)
4. ✅ No errors in logs
5. ✅ Environment variable shows correct whitelist
6. ✅ Pi has both LAN (eth0) and internet (wlan0) connectivity

**Ready for integration when:**
7. ✅ ROS bridge at .101 connects to backend
8. ✅ WebSocket connection shows [accepted] in logs
9. ✅ Gamepad data flows from browser → backend → ROS bridge
10. ✅ Boat responds to commands! 🚢

---

## 🔄 BOAT 2 DIFFERENCES

For reference, Boat 2 configuration:
- LAN IP: 192.168.12.102 (instead of .11.102)
- Gateway: 192.168.12.1 (instead of .11.1)
- ROS Bridge: 192.168.12.101 (instead of .11.101)
- Whitelist: 192.168.12.101,127.0.0.1

Everything else is identical!
