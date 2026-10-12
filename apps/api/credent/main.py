"""ASGI entrypoint: uvicorn credent.main:app"""

import logging

from credent.api.app import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
app = create_app()
