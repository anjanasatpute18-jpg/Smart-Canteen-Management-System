from database import get_connection, DATABASE

print("CHECK DATABASE PATH:", DATABASE)

conn = get_connection()
cursor = conn.cursor()

cursor.execute("""
SELECT Food_id, Food_name, Price, Available
FROM food_menu
WHERE LOWER(Food_name) IN (
    'pav bhaji',
    'veg thali',
    'bhel',
    'puri bhaji'
)
""")

rows = cursor.fetchall()

print("\nMATCHING FOODS:", len(rows))

for row in rows:
    print(
        row["Food_id"],
        "|", row["Food_name"],
        "| Price:", row["Price"],
        "| Available:", row["Available"]
    )

conn.close()