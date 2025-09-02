// Navigation
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const contentSections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Hide all sections
            contentSections.forEach(section => {
                section.style.display = 'none';
            });
            
            // Show the selected section
            const sectionId = `${this.getAttribute('data-section')}-section`;
            document.getElementById(sectionId).style.display = 'block';
            
            // Load data if needed
            if (sectionId === 'calendar-section') {
                loadCalendar();
            }
        });
    });
});

// Schedule functions
async function loadSchedule() {
    try {
        const response = await fetch('/api/schedule');
        const schedules = await response.json();
        
        // Clear schedule body
        const scheduleBody = document.getElementById('schedule-body');
        scheduleBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
        
        // Group schedules by day
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const scheduleByDay = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: []
        };
        
        schedules.forEach(schedule => {
            if (scheduleByDay[schedule.day_of_week]) {
                scheduleByDay[schedule.day_of_week].push(schedule);
            }
        });
        
        // Build schedule table
        let scheduleHTML = '<tr>';
        
        days.forEach(day => {
            scheduleHTML += '<td>';
            
            if (scheduleByDay[day] && scheduleByDay[day].length > 0) {
                scheduleByDay[day].forEach(classItem => {
                    const classType = classItem.modality === 'Virtual' ? 'virtual' : 
                                    classItem.modality === 'Cada 15 días' ? 'biweekly' : 'normal';
                    
                    scheduleHTML += `
                        <div class="class-card class-type-${classType}">
                            <h6>${classItem.group || 'Grupo'}</h6>
                            <p class="mb-1"><strong>${classItem.subject}</strong></p>
                            <p class="mb-1"><small>Docente: ${classItem.teacher || 'Sin especificar'}</small></p>
                            <span class="badge ${classType === 'virtual' ? 'bg-primary' : classType === 'biweekly' ? 'bg-danger' : 'bg-success'}">${classItem.modality}</span>
                            ${classItem.has_class_today ? '<span class="badge bg-info ms-1">Hoy</span>' : ''}
                        </div>
                    `;
                });
            } else {
                scheduleHTML += `
                    <div class="class-card">
                        <h6>Sin Clase</h6>
                    </div>
                `;
            }
            
            scheduleHTML += '</td>';
        });
        
        scheduleHTML += '</tr>';
        scheduleBody.innerHTML = scheduleHTML;
        
        // Also update schedule list in manage section
        updateScheduleList(schedules);
        
        // Update subjects dropdown
        updateSubjectsDropdown(schedules);
    } catch (error) {
        console.error('Error loading schedule:', error);
    }
}

function updateScheduleList(schedules) {
    const scheduleList = document.getElementById('schedule-list');
    
    if (!schedules || schedules.length === 0) {
        scheduleList.innerHTML = '<p class="text-center">No hay clases registradas.</p>';
        return;
    }
    
    let html = '';
    schedules.forEach(schedule => {
        html += `
            <div class="schedule-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${schedule.subject}</strong> - ${schedule.day_of_week}
                        <br>
                        <small>${schedule.modality} • ${schedule.teacher || 'Sin docente'}</small>
                    </div>
                    <div class="delete-btn" onclick="deleteSchedule(${schedule.id})">
                        <i class="fas fa-trash"></i>
                    </div>
                </div>
            </div>
        `;
    });
    
    scheduleList.innerHTML = html;
}

function updateSubjectsDropdown(schedules) {
    const subjectDropdown = document.getElementById('subject');
    const newSubjectInput = document.getElementById('new-subject');
    
    // Get unique subjects
    const subjects = [...new Set(schedules.map(s => s.subject))];
    
    // Clear and update dropdown
    subjectDropdown.innerHTML = '<option value="">Seleccionar materia...</option>';
    subjects.forEach(subject => {
        subjectDropdown.innerHTML += `<option value="${subject}">${subject}</option>`;
    });
    
    // Also update the datalist for new subject input if it exists
    if (newSubjectInput) {
        // Create or update datalist
        let datalist = document.getElementById('subjects-list');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'subjects-list';
            newSubjectInput.setAttribute('list', 'subjects-list');
            document.body.appendChild(datalist);
        }
        
        datalist.innerHTML = '';
        subjects.forEach(subject => {
            datalist.innerHTML += `<option value="${subject}">`;
        });
    }
}

async function addSchedule(event) {
    event.preventDefault();
    
    const formData = {
        day_of_week: document.getElementById('day').value,
        subject: document.getElementById('new-subject').value,
        group: document.getElementById('group').value,
        modality: document.getElementById('modality').value,
        teacher: document.getElementById('teacher').value,
        biweekly: document.getElementById('modality').value === 'Cada 15 días',
        start_date: document.getElementById('modality').value === 'Cada 15 días' ? 
                   document.getElementById('start-date').value : undefined
    };
    
    try {
        const response = await fetch('/api/schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            alert('Clase agregada correctamente');
            document.getElementById('schedule-form').reset();
            loadSchedule();
        } else {
            alert('Error al agregar la clase');
        }
    } catch (error) {
        console.error('Error adding schedule:', error);
        alert('Error al agregar la clase');
    }
}

async function deleteSchedule(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta clase?')) return;
    
    try {
        const response = await fetch(`/api/schedule/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Clase eliminada correctamente');
            loadSchedule();
        } else {
            alert('Error al eliminar la clase');
        }
    } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('Error al eliminar la clase');
    }
}

// Calendar functions
let currentDate = new Date();

async function loadCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    try {
        const response = await fetch(`/api/calendar?year=${year}&month=${month}`);
        const weeks = await response.json();
        
        // Update month/year display
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        document.getElementById('current-month-year').textContent = 
            `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        
        // Build calendar
        let calendarHTML = `
            <div class="row mb-2 fw-bold">
                <div class="col p-2 text-center">Lun</div>
                <div class="col p-2 text-center">Mar</div>
                <div class="col p-2 text-center">Mié</div>
                <div class="col p-2 text-center">Jue</div>
                <div class="col p-2 text-center">Vie</div>
                <div class="col p-2 text-center">Sáb</div>
                <div class="col p-2 text-center">Dom</div>
            </div>
        `;
        
        weeks.forEach(week => {
            calendarHTML += '<div class="row">';
            
            week.forEach(day => {
                let dayClass = 'calendar-day p-2 text-center';
                let dayContent = day.day ? `<div class="fw-bold">${day.day}</div>` : '';
                
                // Check if today
                const today = new Date();
                if (day.day && currentDate.getMonth() === today.getMonth() && 
                    currentDate.getFullYear() === today.getFullYear() && day.day === today.getDate()) {
                    dayClass += ' today';
                }
                
                // Add classes for this day
                if (day.classes && day.classes.length > 0) {
                    day.classes.forEach(cls => {
                        dayClass += cls.biweekly ? ' biweekly-class' : ' has-class';
                        dayContent += `<div><small>${cls.subject}</small></div>`;
                    });
                }
                
                calendarHTML += `<div class="col ${dayClass}">${dayContent}</div>`;
            });
            
            calendarHTML += '</div>';
        });
        
        document.getElementById('calendar').innerHTML = calendarHTML;
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

document.getElementById('prev-month')?.addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadCalendar();
});

document.getElementById('next-month')?.addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadCalendar();
});

// Grade functions
async function loadGrades() {
    try {
        const response = await fetch('/api/grade');
        const grades = await response.json();
        
        updateGradesSummary(grades);
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

function updateGradesSummary(grades) {
    const gradesSummary = document.getElementById('grades-summary');
    
    if (!grades || grades.length === 0) {
        gradesSummary.innerHTML = '<p class="text-center">No hay notas registradas.</p>';
        return;
    }
    
    // Group grades by subject
    const gradesBySubject = {};
    grades.forEach(grade => {
        if (!gradesBySubject[grade.subject]) {
            gradesBySubject[grade.subject] = [];
        }
        gradesBySubject[grade.subject].push(grade);
    });
    
    let summaryHTML = '';
    
    for (const subject in gradesBySubject) {
        summaryHTML += `
            <div class="card mb-3">
                <div class="card-header bg-light fw-bold">${subject}</div>
                <div class="card-body">
        `;
        
        let totalWeighted = 0;
        let totalPercentage = 0;
        
        gradesBySubject[subject].forEach(grade => {
            const weighted = grade.grade * (grade.percentage / 100);
            totalWeighted += weighted;
            totalPercentage += grade.percentage;
            
            summaryHTML += `
                <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                    <div>
                        <strong>${grade.description}</strong><br>
                        <small class="text-muted">${grade.percentage}% - ${new Date(grade.date).toLocaleDateString()}</small>
                    </div>
                    <div class="fw-bold">${grade.grade.toFixed(2)}</div>
                    <div class="delete-btn" onclick="deleteGrade(${grade.id})">
                        <i class="fas fa-trash"></i>
                    </div>
                </div>
            `;
        });
        
        const finalGrade = totalPercentage > 0 ? (totalWeighted / totalPercentage) * 100 : 0;
        
        summaryHTML += `
                    <div class="d-flex justify-content-between mt-3 pt-2 border-top">
                        <div class="fw-bold">Nota Final</div>
                        <div class="fw-bold ${finalGrade >= 3.0 ? 'text-success' : 'text-danger'}">
                            ${finalGrade.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    gradesSummary.innerHTML = summaryHTML;
}

async function addGrade(event) {
    event.preventDefault();
    
    const formData = {
        subject: document.getElementById('subject').value,
        grade: document.getElementById('grade').value,
        percentage: document.getElementById('percentage').value,
        description: document.getElementById('description').value,
        date: document.getElementById('date').value
    };
    
    try {
        const response = await fetch('/api/grade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            alert('Nota agregada correctamente');
            document.getElementById('grade-form').reset();
            document.getElementById('date').valueAsDate = new Date();
            loadGrades();
        } else {
            alert('Error al agregar la nota');
        }
    } catch (error) {
        console.error('Error adding grade:', error);
        alert('Error al agregar la nota');
    }
}

async function deleteGrade(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) return;
    
    try {
        const response = await fetch(`/api/grade/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Nota eliminada correctamente');
            loadGrades();
        } else {
            alert('Error al eliminar la nota');
        }
    } catch (error) {
        console.error('Error deleting grade:', error);
        alert('Error al eliminar la nota');
    }
}

// Load subjects for dropdown
async function loadSubjects() {
    try {
        const response = await fetch('/api/schedule');
        const schedules = await response.json();
        updateSubjectsDropdown(schedules);
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

// Event listeners
document.getElementById('grade-form')?.addEventListener('submit', addGrade);
document.getElementById('schedule-form')?.addEventListener('submit', addSchedule);