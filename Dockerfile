FROM ubuntu:22.04

RUN mkdir /var/opt/livestreamer
WORKDIR /opt/livestreamer

RUN apt update -y && apt install -y ca-certificates curl build-essential software-properties-common nethogs python3-pip
RUN add-apt-repository ppa:savoury1/mpv -y
RUN add-apt-repository ppa:ubuntuhandbook1/ffmpeg7 -y
# RUN add-apt-repository ppa:savoury1/ffmpeg4 -y
# RUN add-apt-repository ppa:savoury1/ffmpeg7 -y
RUN apt-get update -y
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
RUN apt-get install -y nodejs
RUN dpkg --configure -a
COPY --from=mpv mpv.deb /tmp/mpv.deb
RUN apt install -y git ffmpeg /tmp/mpv.deb

# RUN npm config set strict-ssl false
# RUN npm pkg delete devDependencies
# RUN npm i --omit=dev

# Tell Node where to find global modules

# CMD ["sleep", "infinity"]
# CMD ["pm2-runtime", "src/pm2.config.cjs"]

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY package.json .
RUN npm i
COPY ./src ./src
COPY ./dist ./dist

# ENTRYPOINT [ "docker-entrypoint.sh" ]
WORKDIR /opt/livestreamer/src
CMD [ "node", "index.js" ]