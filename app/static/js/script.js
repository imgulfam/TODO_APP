
document.addEventListener('DOMContentLoaded', function() {

    // Helper function to handle all background form submissions
    const handleFormSubmit = async (form) => {
        try {
            const formData = new FormData(form);
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            return await response.json();
        } catch (error) {
            console.error('Form submission error:', error);
            return { success: false, message: 'A network error occurred.' };
        }
    };

    // --- 1. Handle Adding a New Task ---
    const addTaskForm = document.getElementById('add-task-form');
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const data = await handleFormSubmit(addTaskForm);
            if (data.success) {
                showNotification(data.message, 'success');
                renderTaskList(data.tasks, data.today);
                addTaskForm.reset();
            } else {
                showNotification(data.message, 'danger');
            }
        });
    }

    // --- 2. Handle All Form Submissions within the Task List ---
    const taskList = document.getElementById('task-list');
    if (taskList) {
        taskList.addEventListener('submit', async function(event) {
            const form = event.target.closest('form');
            if (!form) return;

            event.preventDefault();
            const data = await handleFormSubmit(form);

            if (data.success) {
                showNotification(data.message, 'success');

                const row = form.closest('tr.task-row');
                
                if (form.action.includes('/delete/')) {
                    fadeOutAndRemove(row);
                    if (row.nextElementSibling && row.nextElementSibling.classList.contains('description-row')) {
                        fadeOutAndRemove(row.nextElementSibling);
                    }
                } else if (form.action.includes('/toggle/')) {
                    const badge = row.querySelector('.badge');
                    badge.textContent = data.new_status;
                    badge.className = `badge ${data.new_status.toLowerCase()}`;
                } else if (form.action.includes('/update_deadline/')) {
                    const displayDiv = form.closest('td').querySelector('.deadline-display');
                    if (data.deadline_time) {
                        displayDiv.innerHTML = `<div>${data.deadline_time}<br><small class="date-secondary">${data.deadline_date}</small></div>`;
                    } else {
                        displayDiv.innerHTML = `<span style="color: #888;">None</span>`;
                    }
                    toggleEdit(event, 'deadline', row.dataset.taskId);
                } else if (form.action.includes('/update_description/')) {
                    const descriptionContent = form.closest('.description-content');
                    const p = descriptionContent.querySelector('p');
                    p.textContent = data.new_description || 'No description provided.';
                    
                    // --- THIS IS THE FIX ---
                    // Manually hide the form and show the display text
                    const displayDiv = descriptionContent.querySelector('.description-display');
                    form.style.display = 'none';
                    displayDiv.style.display = 'block';
                }
            } else {
                showNotification(data.message, 'danger');
            }
        });
    }
    
    // --- 3. Handle Clearing All Tasks ---
    const clearTasksForm = document.getElementById('clear-tasks-form');
    if (clearTasksForm) {
        clearTasksForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            if (confirm('Are you sure you want to delete all tasks? This action cannot be undone.')) {
                const data = await handleFormSubmit(clearTasksForm);
                if (data.success) {
                    const taskListBody = document.getElementById('task-list');
                    taskListBody.innerHTML = '';
                    showNotification(data.message, 'info');
                } else {
                    showNotification(data.message, 'danger');
                }
            }
        });
    }
});


// Function to redraw the entire task list
function renderTaskList(tasks, todayStr) {
    const taskListBody = document.getElementById('task-list');
    const noTasksMessage = document.getElementById('no-tasks-message');
    
    if (tasks.length === 0) {
        taskListBody.innerHTML = '';
        if(noTasksMessage) noTasksMessage.style.display = 'block';
        return;
    }
    
    if(noTasksMessage) noTasksMessage.style.display = 'none';
    
    let html = '';
    tasks.forEach((task, index) => {
        let task_class = '';
        if (task.deadline_date) {
            const deadlineDate = new Date(task.deadline_date.replace(' ', ', ')).toISOString().split('T')[0];
            if (deadlineDate < todayStr) {
                task_class = 'overdue';
            } else if (deadlineDate === todayStr) {
                task_class = 'due-today';
            }
        }

        const descriptionHTML = task.description ? `<p>${task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : `<p>No description provided.</p>`;
        const deadlineDisplayHTML = task.deadline_time 
            ? `<div>${task.deadline_time}<br><small class="date-secondary">${task.deadline_date}</small></div>`
            : `<span style="color: #888;">None</span>`;
        const descriptionTextarea = task.description ? task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

        html += `
            <tr class="task-row ${task_class}" data-task-id="${task.id}" onclick="toggleDescriptionRow(this)">
                <td data-label="#">${index + 1}</td>
                <td data-label="Task" class="task-title">${task.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
                <td data-label="Status" class="task-status"><span class="badge ${task.status.toLowerCase()}">${task.status}</span></td>
                <td data-label="Created On" class="task-created"><div>${task.created_at_time}<br><small class="date-secondary">${task.created_at_date}</small></div></td>
                <td data-label="Deadline" class="task-deadline">
                    <div class="deadline-display" onclick="toggleEdit(event, 'deadline', ${task.id})" title="Click to edit deadline">${deadlineDisplayHTML}</div>
                    <form class="deadline-edit-form" action="/update_deadline/${task.id}" method="POST" style="display: none;" onclick="event.stopPropagation()">
                        <input type="datetime-local" name="new_deadline" value="${task.deadline_form_value}">
                        <button type="submit" class="btn-small">Save</button>
                        <button type="button" class="btn-small btn-danger" onclick="toggleEdit(event, 'deadline', ${task.id})">Cancel</button>
                    </form>
                </td>
                <td data-label="Actions" class="task-actions" onclick="event.stopPropagation()">
                    <form action="/toggle/${task.id}" method="POST" style="display:inline;"><button class="btn-small" type="submit">Next</button></form>
                    <form action="/delete/${task.id}" method="POST" style="display:inline;"><button class="btn-small btn-danger" type="submit">Delete</button></form>
                </td>
            </tr>
            <tr class="description-row">
                <td colspan="6">
                    <div class="description-content">
                        <div class="description-display">
                            <strong>Description:</strong>
                            ${descriptionHTML}
                            <button class="btn-small" onclick="toggleEdit(event, 'description', ${task.id})">Edit</button>
                        </div>
                        <form class="description-edit-form" action="/update_description/${task.id}" method="POST" style="display: none;">
                            <textarea name="new_description" class="description-textarea">${descriptionTextarea}</textarea>
                            <div>
                                <button type="submit" class="btn-small">Save</button>
                                <button type="button" class="btn-small btn-danger" onclick="toggleEdit(event, 'description', ${task.id})">Cancel</button>
                            </div>
                        </form>
                    </div>
                </td>
            </tr>
        `;
    });
    taskListBody.innerHTML = html;
}

// Helper Functions
function fadeOutAndRemove(element) {
    if (!element) return;
    element.style.transition = 'opacity 0.3s ease';
    element.style.opacity = '0';
    setTimeout(() => element.remove(), 300);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}