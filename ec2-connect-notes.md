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