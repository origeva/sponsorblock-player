FROM node:17.9.0-alpine3.14

WORKDIR /app

RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /app/yt-dlp
RUN chmod a+rx /app/yt-dlp

ENV NODE_ENV=production PORT=8080
ENV LOG_LEVEL=info
ENV APPLICATION_ID=
ENV BOT_SECRET=
ENV YOUTUBE_API_TOKEN=
ENV SPOTIFY_CLIENT_ID= SPOTIFY_CLIENT_SECRET= SPOTIFY_REDIRECT_URI=
ENV YTDLP=/app/yt-dlp

COPY package*.json .

RUN npm install

COPY ./dist ./dist

EXPOSE 8080

ENTRYPOINT [ "node", "." ]