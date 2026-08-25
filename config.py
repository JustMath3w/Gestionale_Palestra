import os

# Tipo di repository per la persistenza: "JSON" o "SQLITE"
REPOSITORY_TYPE = "SQLITE"

# URL del database SQLite (usato se REPOSITORY_TYPE è "SQLITE")
DATABASE_URL = "sqlite:///./gym.db"

# Cartella per i file JSON (usata se REPOSITORY_TYPE è "JSON")
JSON_DATA_DIR = "./data"
