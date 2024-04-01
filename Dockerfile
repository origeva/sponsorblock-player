FROM node:18.14.2-alpine3.17 AS build
WORKDIR /app

COPY package*.json .
RUN npm install

COPY tsconfig.json tsconfig.json

COPY src src

RUN npm run build



FROM node:18.14.2-alpine3.17

WORKDIR /app

RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools

ENV YTDLP=/usr/bin/yt-dlp
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O ${YTDLP}
RUN chmod a+rx ${YTDLP}

ENV NODE_ENV=production

COPY --from=build /app/package*.json .

RUN npm install

COPY --from=build /app/dist dist

COPY resources resources

COPY config.json config.json

EXPOSE 80

ENTRYPOINT [ "node", "." ]