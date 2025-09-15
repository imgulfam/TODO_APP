
from flask import Blueprint, redirect, render_template, url_for, session, flash, request, abort, jsonify
from functools import wraps
from zoneinfo import ZoneInfo
from datetime import datetime
from sqlalchemy import case
from app import db
from app.models import Task

tasks_bp = Blueprint('task', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify(success=False, message="User not logged in."), 401
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

@tasks_bp.route('/')
@login_required
def view_tasks():
    local_zone = ZoneInfo("Asia/Kolkata")
    now = datetime.now(local_zone)

    # CASE: upcoming -> 0, no-deadline -> 1, overdue -> 2
    # pass whens as positional tuple arguments (SQLAlchemy 1.4+/2.x)
    status_case = case(
        (Task.deadline == None, 1),
        (Task.deadline < now, 2),
        else_=0
    )

    tasks_from_db = (
        Task.query.filter_by(user_id=session['user_id'])
        .order_by(
            status_case,
            Task.deadline.asc().nullslast(),
            Task.created_at.desc()
        )
        .all()
    )

    today = now.date()
    for task in tasks_from_db:
        task.created_at = task.created_at.astimezone(local_zone)
        if task.deadline:
            task.deadline = task.deadline.astimezone(local_zone)

    return render_template('tasks.html', tasks=tasks_from_db, today=today, now=now)


@tasks_bp.route('/add', methods=["POST"])
@login_required
def add_task():
    title = request.form.get('title', '').strip()
    description = request.form.get('description', '').strip()
    deadline_str = request.form.get('deadline')
    
    if not title:
        return jsonify(success=False, message="Task title cannot be empty.")

    deadline_local = None
    if deadline_str:
        try:
            naive_deadline = datetime.strptime(deadline_str, '%Y-%m-%dT%H:%M')
            local_zone = ZoneInfo("Asia/Kolkata")
            deadline_local = naive_deadline.replace(tzinfo=local_zone)

            # ✅ NEW: prevent past deadlines
            now = datetime.now(local_zone)
            if deadline_local < now:
                flash("Deadline cannot be in the past.", "danger")
                return redirect(url_for("task.view_tasks"))

        except ValueError:
            return jsonify(success=False, message="Invalid deadline format.")

    new_task = Task(title=title, description=description, user_id=session['user_id'], deadline=deadline_local)
    db.session.add(new_task)
    db.session.commit()
    
    # After adding, return the whole sorted list (same ordering logic)
    now = datetime.now(ZoneInfo("Asia/Kolkata"))

    status_case = case(
        (Task.deadline == None, 1),
        (Task.deadline < now, 2),
        else_=0
    )

    all_tasks = (
        Task.query.filter_by(user_id=session['user_id'])
        .order_by(
            status_case,
            Task.deadline.asc().nullslast(),
            Task.created_at.desc()
        )
        .all()
    )

    local_zone = ZoneInfo("Asia/Kolkata")
    today_str = now.date().isoformat()
    
    tasks_data = []
    for task in all_tasks:
        created_at_local = task.created_at.astimezone(local_zone)
        deadline_local_display = task.deadline.astimezone(local_zone) if task.deadline else None
        tasks_data.append({
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'created_at_time': created_at_local.strftime('%I:%M %p'),
            'created_at_date': created_at_local.strftime('%d %b %Y'),
            'deadline_time': deadline_local_display.strftime('%I:%M %p') if deadline_local_display else None,
            'deadline_date': deadline_local_display.strftime('%d %b %Y') if deadline_local_display else None,
            'deadline_form_value': deadline_local_display.strftime('%Y-%m-%dT%H:%M') if deadline_local_display else ''
        })

    return jsonify(success=True, message="Task added successfully!", tasks=tasks_data, today=today_str)


@tasks_bp.route('/update_description/<int:task_id>', methods=["POST"])
@login_required
def update_description(task_id):
    task = Task.query.get_or_404(task_id)
    if task.owner.id != session['user_id']:
        return jsonify(success=False, message="Unauthorized"), 403

    new_description = request.form.get('new_description', '').strip()
    task.description = new_description
    db.session.commit()
    return jsonify(success=True, message="Description updated.", new_description=new_description)


@tasks_bp.route('/update_deadline/<int:task_id>', methods=["POST"])
@login_required
def update_deadline(task_id):
    task = Task.query.get_or_404(task_id)
    if task.owner.id != session['user_id']:
        return jsonify(success=False, message="Unauthorized"), 403
    
    new_deadline_str = request.form.get('new_deadline')
    if new_deadline_str:
        try:
            naive_deadline = datetime.strptime(new_deadline_str, '%Y-%m-%dT%H:%M')
            local_zone = ZoneInfo("Asia/Kolkata")
            new_deadline_local = naive_deadline.replace(tzinfo=local_zone)

            # ✅ NEW: prevent updating to past deadline
            now = datetime.now(local_zone)
            if new_deadline_local < now:
                return jsonify(success=False, message="Deadline cannot be set in the past."), 400

            task.deadline = new_deadline_local
            db.session.commit()
            deadline_local_display = task.deadline.astimezone(local_zone)
            return jsonify(
                success=True, 
                message="Deadline updated.",
                deadline_time=deadline_local_display.strftime('%I:%M %p'),
                deadline_date=deadline_local_display.strftime('%d %b %Y')
            )
        except ValueError:
            return jsonify(success=False, message="Invalid deadline format.")
    else:
        task.deadline = None
        db.session.commit()
        return jsonify(success=True, message="Deadline removed.")



@tasks_bp.route('/toggle/<int:task_id>', methods=["POST"])
@login_required
def toggle_status(task_id):
    task = Task.query.get_or_404(task_id)
    if task.owner.id != session['user_id']:
        return jsonify(success=False, message="Unauthorized"), 403
    
    # 🚫 Block status change if task is overdue
    local_zone = ZoneInfo("Asia/Kolkata")
    now = datetime.now(local_zone)
    if task.deadline and task.deadline < now:
        return jsonify(success=False, message="Cannot update status of overdue tasks."), 400

    
    if task.status == 'Pending':
        task.status = 'Working'
    elif task.status == 'Working':
        task.status = 'Done'
    else:
        task.status = 'Pending'
    
    db.session.commit()
    return jsonify(success=True, message="Status updated", new_status=task.status)


@tasks_bp.route('/delete/<int:task_id>', methods=["POST"])
@login_required
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    if task.owner.id != session['user_id']:
        return jsonify(success=False, message="Unauthorized"), 403
    
    db.session.delete(task)
    db.session.commit()
    return jsonify(success=True, message="Task deleted")


@tasks_bp.route('/clear', methods=["POST"])
@login_required
def clear_tasks():
    try:
        Task.query.filter_by(user_id=session['user_id']).delete()
        db.session.commit()
        return jsonify(success=True, message="All tasks have been cleared.")
    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, message="An error occurred.")




## New code we can delete if not work SMPT  From below line we ara updating the code for remainder if

from flask import current_app
from flask_mail import Message
from app import mail   # ✅ use the global mail from __init__.py

@tasks_bp.route("/send-test-email")
def send_test_email():
    try:
        msg = Message(
            subject="✅ Test Email from TaskHub",
            recipients=["mdgulfam4588@gmail.com"],  # replace with your email
            body="This is a test email sent from your TaskHub app via Gmail SMTP!"
        )
        mail.send(msg)
        return "✅ Test email sent! Check your inbox.", 200
    except Exception as e:
        return f"❌ Failed to send email: {str(e)}", 500
    

@tasks_bp.route("/send-reminder/<int:task_id>")
def send_reminder(task_id):
    from app.models import Task, User  # import your models

    task = Task.query.get_or_404(task_id)
    user = task.owner  # assuming you have a relationship Task.owner → User

    if not user or not user.email:
        return "❌ No user/email found for this task", 400

    try:
        deadline_str = task.deadline.strftime("%d %b %Y, %I:%M %p") if task.deadline else "No deadline"
        msg = Message(
            subject=f"⏰ Reminder: {task.title}",
            recipients=[user.email],  # send to the task’s owner
            body=f"Hi {user.name},\n\nThis is a reminder for your task:\n\n"
                 f"📝 {task.title}\n📅 Deadline: {deadline_str}\n\n"
                 f"Please complete it on time!\n\n— TaskHub"
        )
        mail.send(msg)
        return f"✅ Reminder email sent to {user.email}", 200
    except Exception as e:
        return f"❌ Failed to send reminder: {str(e)}", 500


from datetime import timedelta
from app.models import User

@tasks_bp.route("/run-reminders")
def run_reminders():
    local_zone = ZoneInfo("Asia/Kolkata")
    now = datetime.now(local_zone)
    tomorrow_start = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow_start + timedelta(days=1)

    tasks = Task.query.join(User).filter(Task.deadline.isnot(None)).all()

    sent_count = 0
    for task in tasks:
        user = task.owner
        if not user or not user.email:
            continue

        deadline = task.deadline.astimezone(local_zone)

        # --- Case 1: Tomorrow's tasks (send today at 9 AM only) ---
        if tomorrow_start <= deadline < tomorrow_end and now.hour == 9:
            try:
                msg = Message(
                    subject=f"⏰ Reminder: {task.title}",
                    recipients=[user.email],
                    body=f"Hi {user.name},\n\nThis is a reminder for your task tomorrow:\n\n"
                         f"📝 {task.title}\n📅 Deadline: {deadline.strftime('%d %b %Y, %I:%M %p')}\n\n"
                         f"Please plan ahead and be ready!\n\n— TaskHub"
                )
                mail.send(msg)
                sent_count += 1
            except Exception as e:
                print(f"❌ Failed for {user.email}: {e}")

        # --- Case 2: Urgent reminders (within 4 hours) ---
        elif now <= deadline <= now + timedelta(hours=4):
            try:
                msg = Message(
                    subject=f"🚨 Hurry Up! Task Due Soon: {task.title}",
                    recipients=[user.email],
                    body=f"Hi {user.name},\n\nYour task deadline is approaching soon!\n\n"
                         f"📝 {task.title}\n📅 Deadline: {deadline.strftime('%d %b %Y, %I:%M %p')}\n\n"
                         f"⏳ Hurry up and complete it before it’s too late!\n\n— TaskHub"
                )
                mail.send(msg)
                sent_count += 1
            except Exception as e:
                print(f"❌ Failed for {user.email}: {e}")

    return f"✅ Sent {sent_count} reminder(s).", 200
