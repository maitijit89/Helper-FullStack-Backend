import multiprocessing
import os

bind = "0.0.0.0:" + os.getenv("PORT", "8000")
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
keepalive = 120
errorlog = "-"
accesslog = "-"
loglevel = "info" if not os.getenv("DEBUG", "False").lower() in ("true", "1", "t") else "debug"
