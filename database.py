"""
Módulo de modelos para la aplicación Flask.
Define las tablas de base de datos y sus relaciones.
"""

from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    """Modelo de usuario para la aplicación."""

    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relaciones
    schedules = db.relationship('Schedule', backref='user', lazy=True)
    grades = db.relationship('Grade', backref='user', lazy=True)

    def set_password(self, password):
        """Establece la contraseña del usuario."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verifica si la contraseña es correcta."""
        return check_password_hash(self.password_hash, password)


class Schedule(db.Model):
    """Modelo para horarios de clases."""

    __tablename__ = 'schedules'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
   # Ejemplo: 'lunes', 'martes', etc. (en minúsculas)
    day_of_week = db.Column(db.String(10),nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    group = db.Column(db.String(50))
    modality = db.Column(db.String(20))  # Normal, Virtual, Cada 15 días
    teacher = db.Column(db.String(100))
    start_date = db.Column(db.Date, nullable=False)
    biweekly = db.Column(db.Boolean, default=False)

    def is_class_today(self):
        """
        Verifica si la clase es hoy, considerando modalidad normal o cada 15 días.
        day_of_week debe estar en minúsculas y en español ('lunes', 'martes', ...).
        """
        today = date.today()
        dias_semana = {
            'monday': 'lunes', 'tuesday': 'martes', 'wednesday': 'miércoles',
            'thursday': 'jueves', 'friday': 'viernes', 'saturday': 'sábado', 'sunday': 'domingo'
        }
        hoy_es = dias_semana.get(today.strftime('%A').lower(), today.strftime('%A').lower())
        if not self.biweekly:
            return hoy_es == self.day_of_week.lower()
        # Para clases cada 15 días
        days_since_start = (today - self.start_date).days
        if days_since_start < 0:
            return False
        # Verificar si es múltiplo de 14 (cada 15 días)
        return days_since_start % 14 == 0 and hoy_es == self.day_of_week.lower()


class Grade(db.Model):
    """Modelo para calificaciones de usuarios."""

    __tablename__ = 'grades'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    grade = db.Column(db.Float, nullable=False)
    percentage = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(200))
    date = db.Column(db.Date, default=date.today)
