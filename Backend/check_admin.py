import sqlite3

conn = sqlite3.connect("../Database/smart canteen.db")
cursor = conn.cursor()

cursor.execute("SELECT * FROM Admin_table")

rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()