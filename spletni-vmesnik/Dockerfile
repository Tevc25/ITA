FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY shared ./shared

COPY mfe-auth/package*.json ./mfe-auth/
RUN cd mfe-auth && npm ci
COPY mfe-auth ./mfe-auth
RUN cd mfe-auth && npm run build

COPY mfe-parking/package*.json ./mfe-parking/
RUN cd mfe-parking && npm ci
COPY mfe-parking ./mfe-parking
RUN cd mfe-parking && npm run build

COPY mfe-reservations/package*.json ./mfe-reservations/
RUN cd mfe-reservations && npm ci
COPY mfe-reservations ./mfe-reservations
RUN cd mfe-reservations && npm run build

COPY shell/package*.json ./shell/
RUN cd shell && npm ci
COPY shell ./shell

RUN cd shell && npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/shell/dist /usr/share/nginx/html
COPY --from=builder /app/mfe-auth/dist /usr/share/nginx/html/mfe-auth
COPY --from=builder /app/mfe-parking/dist /usr/share/nginx/html/mfe-parking
COPY --from=builder /app/mfe-reservations/dist /usr/share/nginx/html/mfe-reservations

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
