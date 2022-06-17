FROM node:17.9.0-alpine3.14

WORKDIR /app

RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /app/yt-dlp
RUN chmod a+rx /app/yt-dlp

ENV NODE_ENV=production PORT=8080
ENV LOG_LEVEL=info
ENV APPLICATION_ID=796829636846813204
ENV BOT_SECRET=Nzk2ODI5NjM2ODQ2ODEzMjA0.X_dnbQ.8oBIFo1hOL9MHaWAYim7uL8HpoY
ENV YOUTUBE_API_TOKEN=AIzaSyBV6FC5cdxkHAHvimcHcOK0-Ax9hP9BkaM
ENV SPOTIFY_CLIENT_ID=9e37a872138f47e3ae0d430e7e0a8848 SPOTIFY_CLIENT_SECRET=86ce0e882d0b459db6c3f6bccd673cca SPOTIFY_REDIRECT_URI=https://github.com/origeva
ENV YTDLP=/app/yt-dlp

COPY package*.json .

RUN npm install

COPY ./dist ./dist

EXPOSE 8080

ENTRYPOINT [ "node", "." ]