import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'linksphere-default-secret-key-2026')
    RAW_DATABASE_URL = os.getenv('DATABASE_URL', '').strip()

    if RAW_DATABASE_URL and RAW_DATABASE_URL != 'your_supabase_postgresql_connection_string':
        if RAW_DATABASE_URL.startswith('postgres://'):
            SQLALCHEMY_DATABASE_URI = RAW_DATABASE_URL.replace('postgres://', 'postgresql+psycopg://', 1)
        elif RAW_DATABASE_URL.startswith('postgresql://') and not RAW_DATABASE_URL.startswith('postgresql+'):
            SQLALCHEMY_DATABASE_URI = RAW_DATABASE_URL.replace('postgresql://', 'postgresql+psycopg://', 1)
        else:
            SQLALCHEMY_DATABASE_URI = RAW_DATABASE_URL
        print("[LinkSphere] Configured Supabase PostgreSQL connection.")
    else:
        SQLALCHEMY_DATABASE_URI = 'sqlite:///linksphere.db'
        print("[LinkSphere] No Supabase DATABASE_URL configured. Falling back to local SQLite: sqlite:///linksphere.db")

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # n8n Automation Webhooks
    N8N_INVITE_WEBHOOK_URL = os.getenv('N8N_INVITE_WEBHOOK_URL', '').strip()
    N8N_INVITE_TOKEN = os.getenv('N8N_INVITE_TOKEN', '').strip()
