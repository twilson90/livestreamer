FROM ubuntu:22.04

RUN mkdir /var/opt/livestreamer
WORKDIR /opt/livestreamer

RUN apt update -y && apt install -y ca-certificates curl build-essential

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs python3-pip
RUN npm -v
RUN node -v
RUN dpkg --configure -a

RUN npm i pm2@6.0.8 -g
RUN npm i sharp ws pm2
RUN apt-get install -y nethogs

COPY dist ./

# RUN npm config set strict-ssl false
# RUN npm pkg delete devDependencies
# RUN npm i --omit=dev

# Tell Node where to find global modules

# CMD ["sleep", "infinity"]
# CMD ["pm2-runtime", "pm2.config.cjs"]
CMD [ "node", "index.cjs" ]