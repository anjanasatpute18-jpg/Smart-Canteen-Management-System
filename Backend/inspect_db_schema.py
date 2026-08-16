import sqlite3
import os
path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../Database/smart canteen.db'))
print('DB path:', path)
conn = sqlite3.connect(path)
cur = conn.cursor()
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name='student_table';")
row = cur.fetchone()
if row:
    print('student_table schema:')
    print(row[1])
else:
    print('student_table table not found')
conn.close()