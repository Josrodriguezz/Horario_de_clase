"""Módulo para inicializar la base de datos y crear las tablas."""
from app import app, db
from database import User  # pylint: disable=unused-import

with app.app_context():
    # Crear todas las tablas
    db.create_all()
    print("Tablas creadas exitosamente!")
