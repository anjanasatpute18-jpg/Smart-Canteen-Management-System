import sqlite3

# Connect to SQLite database
conn = sqlite3.connect("../Database/smart canteen.db")

# Create cursor
cursor = conn.cursor()

# Get food image information
cursor.execute("""
    SELECT Food_id, Food_name, Image
    FROM food_menu
""")

# Get all records
rows = cursor.fetchall()

print("\nFood Images:\n")

# Display the data
for row in rows:
    print("Food ID:", row[0])
    print("Food Name:", row[1])
    print("Image:", row[2])
    print("-" * 50)

# Close database connection
conn.close()