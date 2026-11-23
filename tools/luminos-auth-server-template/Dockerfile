FROM rust:1-slim AS build
WORKDIR /src
COPY . .
RUN cargo build --release -p luminos-auth

FROM debian:stable-slim
COPY --from=build /src/target/release/luminos-auth /usr/local/bin/luminos-auth
USER nobody
CMD ["luminos-auth"]
