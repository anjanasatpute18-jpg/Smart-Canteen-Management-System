import sqlite3
import os

db_path = os.path.abspath("../Database/smart canteen.db")

print("DATABASE PATH:")
print(db_path)

print("\nDATABASE EXISTS:")
print(os.path.exists(db_path))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(order_table)")

rows = cursor.fetchall()

print("\nORDER TABLE COLUMNS:")
for row in rows:
    print(row)

conn.close()