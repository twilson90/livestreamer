FROM ubuntu:22.04

RUN mkdir /var/opt/livestreamer
WORKDIR /opt/livestreamer

RUN apt update -y
RUN apt install -y \
    ca-certificates \
    curl

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs
RUN npm -v
RUN node -v

RUN apt install -y git ffmpeg yt-dlp nethogs

COPY bin/linux /
RUN apt install -y /*.deb

ENV LIVESTREAMER_DOCKER=1

COPY docker-entrypoint.sh .

ENTRYPOINT [ "./docker-entrypoint.sh" ]

CMD [ "node", "index.js" ]