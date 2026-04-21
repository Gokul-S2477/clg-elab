import sqlite3
import os

db_path = "erp_local.db"
if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # Drop tables that need schema updates
        tables_to_drop = ["user_profiles", "departments", "class_rooms", "faculty_mappings"]
        for table in tables_to_drop:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
        conn.commit()
        conn.close()
        print("Schema reset successful: Affected tables dropped.")
    except Exception as e:
        print(f"Error resetting schema: {e}")
else:
    print("Database file not found. Nothing to reset.")
