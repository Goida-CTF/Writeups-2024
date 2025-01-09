FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y socat && apt-get clean

COPY task.py run.sh ./

CMD ["socat", "tcp-l:31337,reuseaddr,fork", "EXEC:./run.sh,pty,stderr"]