FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:20-bullseye

# ติดตั้ง Python 3 และ venv สำหรับรัน pythonservice ของคุณ
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends python3 python3-pip python3-venv
