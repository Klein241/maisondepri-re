FROM node:20-slim

# Install FFmpeg, yt-dlp, and sharp native deps
RUN apt-get update && \
    apt-get install -y ffmpeg python3 curl build-essential && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p streams replays

EXPOSE 3000

CMD ["node", "server.js"]
