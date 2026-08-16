from database import get_connection

conn = get_connection()
cursor = conn.cursor()

cursor.execute("""
    SELECT Id, Name, Enrollment_No, Email, Department, Mobile
    FROM student_table
    ORDER BY Id DESC
    LIMIT 1
""")

students = cursor.fetchall()

for student in students:
    print(dict(student))

conn.close()