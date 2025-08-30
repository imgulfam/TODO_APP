# TaskHub - A Flask To-Do Application

A full-featured, responsive to-do list web application built with Python, Flask, and PostgreSQL. The application features a modern, interactive frontend that updates instantly without page reloads.

## Key Features

-   **User Authentication:** Secure user registration (Name, Email, Password) and login.
-   **Full Task Management:** Create, edit, and delete tasks with titles, descriptions, and statuses.
-   **Task Deadlines:** Set and update optional deadlines for tasks.
-   **Dynamic UI:** The interface updates instantly without page refreshes, powered by JavaScript.
-   **Responsive Design:** A clean and user-friendly layout that works perfectly on both desktop and mobile devices.
-   **Urgency Highlighting:** Tasks are automatically highlighted if they are overdue or due today.

## Technology Stack

-   **Backend:** Python, Flask
-   **Database:** PostgreSQL
-   **ORM:** Flask-SQLAlchemy with Flask-Migrate for database migrations.
-   **Frontend:** HTML, CSS, JavaScript

## Local Setup

To run this project on your local machine, follow these steps:

1.  **Clone the repository and navigate into the project directory.**

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate
    ```

3.  **Install the required packages:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Create a `.env` file** in the root directory and add the following variables:
    ```
    FLASK_SECRET_KEY=your_super_secret_key_here
    DATABASE_URL=postgresql+psycopg2://YOUR_POSTGRES_USERNAME:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE_NAME
    ```

5.  **Set up the database:**
    Make sure your PostgreSQL server is running and you have created the database. Then, run the migration command:
    ```bash
    # Set the Flask app variable
    # On Windows: set FLASK_APP=run.py
    # On macOS/Linux: export FLASK_APP=run.py

    # Apply the migrations
    flask db upgrade
    ```

6.  **Run the application:**
    ```bash
    python run.py
    ```

The application will be available at `http://127.0.0.1:5000`.