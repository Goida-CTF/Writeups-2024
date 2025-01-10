FROM rust:1.83.0-bullseye AS builder

COPY ./ ./

RUN cargo build --release

FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y socat && apt-get clean

COPY --from=builder ./target/release/kirillcrypt ./

ENV FLAG="ГойдаСтф{НастоящийРусскийСтфСНастоящимиРусскимиФлагами}"

CMD ["socat", "tcp-l:31337,reuseaddr,fork", "EXEC:./kirillcrypt,pty,stderr,icanon=0,echo=0"]
