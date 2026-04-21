import sqlite3

def check_schema():
    conn = sqlite3.connect('erp_local.db')
    cursor = conn.cursor()
    
    tables = ['ask_sb_projects', 'ask_sb_sources', 'ask_sb_chats']
    for table in tables:
        print(f"\nSchema for {table}:")
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = cursor.fetchall()
            for col in columns:
                print(col)
        except Exception as e:
            print(f"Error checking {table}: {e}")
    
    conn.close()

if __name__ == "__main__":
    check_schema()
