import sqlite3

conn = sqlite3.connect("../Database/smart canteen.db")
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(food_menu)")

columns = cursor.fetchall()

print("Columns of food_menu:\n")

for column in columns:
    print(column)

conn.close()
