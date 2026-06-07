import os
from mcp.server.fastmcp import FastMCP
import psycopg2
import json

# Ініціалізація MCP сервера
mcp = FastMCP("postgres-python")

# Отримання параметрів підключення з оточення
DB_HOST = os.getenv("DB_HOST", "db")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_PORT = os.getenv("DB_PORT", "5432")

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT
    )

@mcp.tool()
def list_tables() -> str:
    """Виводить список усіх таблиць у базі."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    tables = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return json.dumps(tables)

@mcp.tool()
def describe_table(table_name: str) -> str:
    """Отримує схему таблиці (колонки, типи даних)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}';")
    schema = {row[0]: row[1] for row in cur.fetchall()}
    cur.close()
    conn.close()
    return json.dumps(schema)

@mcp.tool()
def execute_query(query: str) -> str:
    """Виконує SQL-запит і повертає результат."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(query)
    results = cur.fetchall()
    cur.close()
    conn.close()
    return json.dumps(results)

if __name__ == "__main__":
    mcp.run()
