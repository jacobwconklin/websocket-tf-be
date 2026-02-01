1) Made key-pair with .pem file in this directory locally
2) Made key-pair read only with 
```
chmod 400 tf-ws-key-pair.pem
```
3) Made sure security group in aws allowed ssh from my IP as inbound rule for ec2
4) SSH'd into ec2 with 
```
ssh -i tf-ws-key-pair.pem ec2-user@107.21.133.171
```
5) Installed node and git: 
```
# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install git
sudo yum install -y git

# Install other tools
sudo yum install -y htop
```
6) Cloned repo code 
```
git clone https://github.com/jacobwconklin/websocket-tf-be.git
cd websocket-tf-be
```
7) Intalled pkgs
```
npm install
```
8) Ran server
```
npm run build

npm start
```
9) Ran with nohup in background so exiting terminal will not kill process:
```
nohup npm start > ./start-logs.log 2>&1 &
```



Re-usable pattern:

PM2 stuff (adjust for my commands)
# Install PM2 globally
sudo npm install -g pm2

# Start your server with PM2
pm2 start server.js --name "game-server"

# Make PM2 restart on reboot
pm2 startup
# Follow the command it outputs, something like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save PM2 process list
pm2 save

# Useful PM2 commands:
pm2 list           # Show running processes
pm2 logs           # View logs
pm2 restart game-server
pm2 stop game-server
pm2 delete game-server

Step 11: Monitoring & Logs
bash# PM2 monitoring
pm2 monit

# View logs in real-time
pm2 logs game-server

# System resources
htop  # (install with: sudo apt install htop)

# Disk space
df -h

# Memory usage
free -h


Quick Deployment Script
Create deploy.sh on your local machine:
```
bash#!/bin/bash
SERVER="ubuntu@54.123.45.67"
KEY="~/Downloads/game-server-key.pem"

echo "Deploying to EC2..."

# Upload code
scp -i $KEY -r ./* $SERVER:~/websocket-server/

# Install and restart
ssh -i $KEY $SERVER << 'EOF'
  cd ~/websocket-server
  npm install
  pm2 restart game-server
EOF

echo "Deployment complete!"
```

Make it executable and run:
```
bashchmod +x deploy.sh
./deploy.sh
```






ngrok to serve over https rather than http - testing until SSL and proper HTTPS is set up
# Download ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz

# Extract
tar -xvzf ngrok-v3-stable-linux-amd64.tgz

# Move to /usr/local/bin
sudo mv ngrok /usr/local/bin/

# Verify
ngrok version

# Authenticate (get token from https://dashboard.ngrok.com)
ngrok config add-authtoken YOUR_TOKEN

# Run it
ngrok http 5000