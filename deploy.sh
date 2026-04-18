#!/bin/bash
set -e
git add -A
git commit -m "${1:-deploy}" || true
git push
ssh -p 2222 aaron@192.168.1.240 "cd /volume2/docker_ssd/southwest-cinema-services && git pull && sudo /usr/local/bin/docker compose up -d --build"
echo "Deploy complete — http://192.168.1.240:3000"
