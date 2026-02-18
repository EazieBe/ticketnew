from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from settings import settings

DATABASE_URL = settings.DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
    echo=False,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 