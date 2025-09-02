"""
Aplicación Flask para gestión de horarios estudiantiles.
Maneja usuarios, horarios de clases y calificaciones.
"""

import os
import calendar
from datetime import datetime, date
from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_migrate import Migrate
from dotenv import load_dotenv
from database import db, User, Schedule, Grade

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 'postgresql://username:password@localhost/horario_estudiantil'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
migrate = Migrate(app, db)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


@login_manager.user_loader
def load_user(user_id):
    """Carga el usuario basado en el ID."""
    return User.query.get(int(user_id))


@app.route('/')
def index():
    """Página principal de la aplicación."""
    return render_template('index.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    """Maneja el registro de nuevos usuarios."""
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']

        if User.query.filter_by(email=email).first():
            return render_template('register.html', error='El usuario ya existe')

        new_user = User(name=name, email=email)
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Maneja el inicio de sesión de usuarios."""
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        user = User.query.filter_by(email=email).first()

        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('dashboard'))

        return render_template('login.html', error='Credenciales inválidas')

    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    """Cierra la sesión del usuario actual."""
    logout_user()
    return redirect(url_for('index'))


@app.route('/dashboard')
@login_required
def dashboard():
    """Panel de control del usuario autenticado."""
    return render_template('dashboard.html', user=current_user)


@app.route('/api/schedule', methods=['GET', 'POST'])
@login_required
def handle_schedule():
    """Maneja las operaciones CRUD para horarios."""
    if request.method == 'GET':
        schedules = Schedule.query.filter_by(user_id=current_user.id).all()
        schedule_data = []

        for schedule_item in schedules:
            schedule_data.append({
                'id': schedule_item.id,
                'day_of_week': schedule_item.day_of_week,
                'subject': schedule_item.subject,
                'group': schedule_item.group,
                'modality': schedule_item.modality,
                'teacher': schedule_item.teacher,
                'biweekly': schedule_item.biweekly,
                'start_date': schedule_item.start_date.strftime('%Y-%m-%d') 
                if schedule_item.start_date else None,
                'has_class_today': schedule_item.is_class_today()
            })

        return jsonify(schedule_data)

    elif request.method == 'POST':
        data = request.get_json()

        start_date = (datetime.strptime(data['start_date'], '%Y-%m-%d').date()
                      if data.get('start_date') else date.today())

        new_schedule = Schedule(
            user_id=current_user.id,
            day_of_week=data['day_of_week'],
            subject=data['subject'],
            group=data.get('group'),
            modality=data.get('modality'),
            teacher=data.get('teacher'),
            biweekly=data.get('biweekly', False),
            start_date=start_date
        )

        db.session.add(new_schedule)
        db.session.commit()

        return jsonify({'message': 'Horario agregado correctamente'}), 201


@app.route('/api/schedule/<int:schedule_id>', methods=['DELETE'])
@login_required
def delete_schedule(schedule_id):
    """Elimina un horario específico."""
    schedule = Schedule.query.filter_by(
        id=schedule_id, user_id=current_user.id).first()

    if not schedule:
        return jsonify({'error': 'Horario no encontrado'}), 404

    db.session.delete(schedule)
    db.session.commit()

    return jsonify({'message': 'Horario eliminado correctamente'})


@app.route('/api/grade', methods=['GET', 'POST'])
@login_required
def handle_grades():
    """Maneja las operaciones CRUD para calificaciones."""
    if request.method == 'GET':
        grades = Grade.query.filter_by(user_id=current_user.id).all()
        grades_data = []

        for grade_item in grades:
            grades_data.append({
                'id': grade_item.id,
                'subject': grade_item.subject,
                'grade': grade_item.grade,
                'percentage': grade_item.percentage,
                'description': grade_item.description,
                'date': grade_item.date.strftime('%Y-%m-%d') 
                if grade_item.date else None
            })

        return jsonify(grades_data)

    elif request.method == 'POST':
        data = request.get_json()

        grade_date = (datetime.strptime(data['date'], '%Y-%m-%d').date()
                      if data.get('date') else date.today())

        new_grade = Grade(
            user_id=current_user.id,
            subject=data['subject'],
            grade=float(data['grade']),
            percentage=float(data['percentage']),
            description=data.get('description', ''),
            date=grade_date
        )

        db.session.add(new_grade)
        db.session.commit()

        return jsonify({'message': 'Nota agregada correctamente'}), 201


@app.route('/api/grade/<int:grade_id>', methods=['DELETE'])
@login_required
def delete_grade(grade_id):
    """Elimina una calificación específica."""
    grade = Grade.query.filter_by(id=grade_id, user_id=current_user.id).first()

    if not grade:
        return jsonify({'error': 'Nota no encontrada'}), 404

    db.session.delete(grade)
    db.session.commit()

    return jsonify({'message': 'Nota eliminada correctamente'})


@app.route('/api/calendar')
@login_required
def get_calendar():
    """Genera datos del calendario para el mes y año especificados."""
    year = request.args.get('year', type=int, default=date.today().year)
    month = request.args.get('month', type=int, default=date.today().month)

    # Obtener todos los días del mes
    cal = calendar.Calendar()
    days = cal.monthdayscalendar(year, month)

    # Obtener horarios del usuario
    schedules = Schedule.query.filter_by(user_id=current_user.id).all()

    # Estructura para el calendario
    calendar_data = []
    for week in days:
        week_data = []
        for day in week:
            if day == 0:  # Día fuera del mes
                week_data.append({'day': None, 'classes': []})
                continue

            current_date = date(year, month, day)
            day_classes = []

            for schedule in schedules:
                # Verificar si este día tiene clase
                if schedule.biweekly:
                    # Para clases cada 15 días
                    days_since_start = (current_date - schedule.start_date).days
                    if (days_since_start >= 0 and days_since_start % 14 == 0 and
                        current_date.strftime('%A').lower() ==
                        schedule.day_of_week.lower()):
                        day_classes.append({
                            'subject': schedule.subject,
                            'modality': schedule.modality,
                            'biweekly': True
                        })
                else:
                    # Para clases regulares
                    if (current_date.strftime('%A').lower() ==
                        schedule.day_of_week.lower()):
                        day_classes.append({
                            'subject': schedule.subject,
                            'modality': schedule.modality,
                            'biweekly': False
                        })

            week_data.append({
                'day': day,
                'classes': day_classes
            })

        calendar_data.append(week_data)

    return jsonify(calendar_data)


if __name__ == '__main__':
    app.run(debug=True)
