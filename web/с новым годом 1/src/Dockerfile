FROM node:22.12.0-alpine

ENV NODE_ENV production

WORKDIR /app/

COPY server.js package.json package-lock.json index.html ./
COPY ./static ./static

RUN npm install

USER node

ENV FLAG1="goidactf{flag1_P4D0RU_P4D0RU_4m0ng_u5!!_3z_s34m5_f6814ae3}"
ENV FLAG2="goidactf{flag2_G01D4_fl04t1ng_p01nt_bu11sh1t_lm40_8e55c726}"

CMD ["npm", "start"]
