import sqlite3

conn = sqlite3.connect("../Database/smart canteen.db")
cursor = conn.cursor()

cursor.execute("""
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
""")

tables = cursor.fetchall()

print("\n========== TABLES ==========\n")

for table in tables:
    print(table[0])

print("\n========== COLUMNS ==========\n")

for table in tables:
    table_name = table[0]

    print(f"\n--- {table_name} ---")

    cursor.execute(f'PRAGMA table_info("{table_name}")')

    for column in cursor.fetchall():
        print(
            f"Name={column[1]}, "
            f"Type={column[2]}, "
            f"PK={column[5]}"
        )

conn.close()