
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from dotenv import load_dotenv

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app():
    """Create and configure the Flask application."""
    load_dotenv()

    app = Flask(__name__)
    
    # --- Configuration ---
    # Load secret key from environment variable, with a fallback for development
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'a-very-secret-key-for-dev')
    
    # Load database URL from environment variable, with a fallback to SQLite for local testing
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL',
        'sqlite:///tasks.db' 
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # --- Initialize Extensions with App ---
    db.init_app(app)
    migrate.init_app(app, db)

    # --- Import and Register Blueprints ---
    from app.routes.auth import auth_bp
    from app.routes.task import tasks_bp
    
    # Register the auth blueprint with a URL prefix of /auth
    app.register_blueprint(auth_bp, url_prefix='/auth')
    
    # Register the task blueprint without a prefix, so its routes are at the root
    app.register_blueprint(tasks_bp)

    return app
