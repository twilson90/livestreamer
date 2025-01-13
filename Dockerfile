FROM ubuntu:22.04

RUN mkdir /var/opt/livestreamer
WORKDIR /opt/livestreamer

ENV CACHBUST=1
RUN apt update -y
RUN apt install -y ca-certificates curl

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs python3-pip
RUN npm -v
RUN node -v
RUN dpkg --configure -a

# COPY package*.json .
# RUN npm config set strict-ssl false
# RUN npm pkg delete devDependencies
# RUN npm i --omit=dev
# RUN npm i pm2 -g

CMD [ "node", "index.js" ]
# CMD ["pm2-runtime", "pm2.config.cjs"]