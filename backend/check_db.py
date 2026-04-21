import sqlite3
import os

db_path = "erp_local.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(user_profiles)")
    columns = cursor.fetchall()
    print("Columns in user_profiles:")
    for col in columns:
        print(col[1])
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print("\nAll tables:")
    for table in tables:
        print(table[0])
    conn.close()
else:
    print("DB not found")
