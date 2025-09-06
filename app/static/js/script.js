// script.js (full file) - Replace your existing file with this

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
            if (data && data.success) {
                showNotification(data.message, 'success');
                // server should return tasks array and today string (like your original code)
                if (Array.isArray(data.tasks)) {
                    renderTaskList(data.tasks, data.today);
                    addTaskForm.reset();
                } else {
                    // fallback to reload if server didn't return tasks list
                    location.reload();
                }
            } else {
                showNotification((data && data.message) || 'Error adding task', 'danger');
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

            if (data && data.success) {
                showNotification(data.message, 'success');

                const row = form.closest('tr.task-row');

                // delete
                if (form.action.includes('/delete/')) {
                    if (row) {
                        fadeOutAndRemove(row);
                        if (row.nextElementSibling && row.nextElementSibling.classList.contains('description-row')) {
                            fadeOutAndRemove(row.nextElementSibling);
                        }
                    } else {
                        location.reload();
                    }
                }
                // toggle status
                else if (form.action.includes('/toggle/')) {
                    if (row) {
                        const badge = row.querySelector('.badge');
                        if (badge && data.new_status) {
                            badge.textContent = data.new_status;
                            badge.className = `badge ${data.new_status.toLowerCase()}`;
                        }
                    }
                }
                // update deadline
                else if (form.action.includes('/update_deadline/')) {
                    const displayDiv = form.closest('td').querySelector('.deadline-display');
                    if (displayDiv) {
                        if (data.deadline_time) {
                            displayDiv.innerHTML = `<div>${data.deadline_time}<br><small class="date-secondary">${data.deadline_date}</small></div>`;
                        } else {
                            displayDiv.innerHTML = `<span style="color: #888;">None</span>`;
                        }
                        displayDiv.style.display = 'block';
                    }

                    // hide the edit form (keep same UX as before)
                    form.style.display = 'none';

                    // --- IMPORTANT: update mobile inline label under the title for this row ---
                    if (row) {
                        const mobileLabel = row.querySelector('.mobile-deadline');
                        if (mobileLabel) {
                            if (data.deadline_time) {
                                mobileLabel.textContent = `Due on: ${data.deadline_date} ${data.deadline_time}`;
                                mobileLabel.style.color = '';
                            } else {
                                mobileLabel.textContent = 'No deadline';
                                mobileLabel.style.color = '#888';
                            }
                        }
                    }
                }
                // update description
                else if (form.action.includes('/update_description/')) {
                    const descriptionContent = form.closest('.description-content');
                    if (descriptionContent) {
                        const p = descriptionContent.querySelector('p');
                        if (p) p.textContent = data.new_description || 'No description provided.';

                        // hide form and show display
                        form.style.display = 'none';
                        const displayDiv = descriptionContent.querySelector('.description-display');
                        if (displayDiv) displayDiv.style.display = 'block';
                    } else {
                        // fallback: update next description row if present
                        if (row && row.nextElementSibling && row.nextElementSibling.classList.contains('description-row')) {
                            const descRow = row.nextElementSibling;
                            const p = descRow.querySelector('.description-display p');
                            if (p) p.textContent = data.new_description || 'No description provided.';
                            const editForm = descRow.querySelector('.description-edit-form');
                            const displayDiv = descRow.querySelector('.description-display');
                            if (editForm) editForm.style.display = 'none';
                            if (displayDiv) displayDiv.style.display = 'block';
                        }
                    }
                }

            } else {
                showNotification((data && data.message) || 'Server error', 'danger');
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
                if (data && data.success) {
                    const taskListBody = document.getElementById('task-list');
                    if (taskListBody) taskListBody.innerHTML = '';
                    showNotification(data.message, 'info');
                } else {
                    showNotification((data && data.message) || 'Error clearing tasks', 'danger');
                }
            }
        });
    }
});

// Function to redraw the entire task list
function renderTaskList(tasks, todayStr) {
    const taskListBody = document.getElementById('task-list');
    const noTasksMessage = document.getElementById('no-tasks-message');

    if (!taskListBody) return;

    if (!tasks || tasks.length === 0) {
        taskListBody.innerHTML = '';
        if (noTasksMessage) noTasksMessage.style.display = 'block';
        return;
    }

    if (noTasksMessage) noTasksMessage.style.display = 'none';

    let html = '';
    tasks.forEach((task, index) => {
        let task_class = '';
        if (task.deadline_date) {
            try {
                const deadlineDate = new Date(task.deadline_date.replace(' ', ', ')).toISOString().split('T')[0];
                if (deadlineDate < todayStr) task_class = 'overdue';
                else if (deadlineDate === todayStr) task_class = 'due-today';
            } catch (e) {
                // ignore parse issues
            }
        }

        const descriptionHTML = task.description ? `<p>${task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : `<p>No description provided.</p>`;
        const deadlineDisplayHTML = task.deadline_time 
            ? `<div>${task.deadline_time}<br><small class="date-secondary">${task.deadline_date}</small></div>`
            : `<span style="color: #888;">None</span>`;
        const descriptionTextarea = task.description ? task.description.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

        // Mobile inline label string
        const mobileDueHTML = task.deadline_time ? `Due on: ${task.deadline_date} ${task.deadline_time}` : 'No deadline';

        html += `
            <tr class="task-row ${task_class}" data-task-id="${task.id}" onclick="toggleRow(this)">
                <td data-label="#">${index + 1}</td>
                <td data-label="Task" class="task-title">
                    ${task.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                    <small class="mobile-deadline">${mobileDueHTML}</small>
                </td>
                <td data-label="Status" class="task-status"><span class="badge ${task.status.toLowerCase()}">${task.status}</span></td>
                <td data-label="Created On" class="task-created"><div>${task.created_at_time || ''}${task.created_at_time ? '<br>' : ''}<small class="date-secondary">${task.created_at_date || ''}</small></div></td>
                <td data-label="Deadline" class="task-deadline">
                    <div class="deadline-display" onclick="toggleEdit(event, 'deadline', ${task.id})" title="Click to edit deadline">${deadlineDisplayHTML}</div>
                    <form class="deadline-edit-form" action="/update_deadline/${task.id}" method="POST" style="display: none;" onclick="event.stopPropagation()">
                        <input type="datetime-local" name="new_deadline" value="${task.deadline_form_value || ''}">
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

// small helpers (unchanged)
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
