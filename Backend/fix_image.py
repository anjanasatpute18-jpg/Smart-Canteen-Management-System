import sqlite3

conn = sqlite3.connect("../Database/smart canteen.db")

conn.execute("""
UPDATE food_menu
SET Image = 'assest\\images\\food\\Tea.jpg'
WHERE Food_id = 1
""")

conn.commit()

print(
    conn.execute(
        "SELECT Food_id, Food_name, Image FROM food_menu WHERE Food_id=1"
    ).fetchone()
)

conn.close()