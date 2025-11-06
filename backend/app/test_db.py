from sqlalchemy import create_engine, text

# DATABASE_URL = "postgresql://postgres:qwer1234@localhost:5433/saas_db"
DATABASE_URL = "postgresql+psycopg://postgres:qwer1234@localhost:5433/saas_db"

engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✅ Database connection successful!")
        print(f"Result: {result.scalar()}")
except Exception as e:
    print(f"❌ Database connection failed: {e}")
