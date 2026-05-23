FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x scripts/start-production.sh

ENV FLASK_APP=run:app

EXPOSE 5000

CMD ["scripts/start-production.sh"]
