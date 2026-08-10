from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import config
from models import Base

# Creazione dell'engine SQLAlchemy
# L'argomento check_same_thread=False è necessario solo per SQLite
engine = create_engine(
    config.DATABASE_URL, connect_args={"check_same_thread": False}
)

# Configurazione del factory delle sessioni
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """
    Inizializza il database creando tutte le tabelle.
    Chiamato all'avvio dell'applicazione.
    """
    if config.REPOSITORY_TYPE == "SQLITE":
        Base.metadata.create_all(bind=engine)
