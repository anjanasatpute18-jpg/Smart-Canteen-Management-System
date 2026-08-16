from flask import Blueprint, request, jsonify
import sqlite3

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/admin/login', methods=['POST'])
def admin_login():

    data = request.json

    email = data['email']
    password = data['password']

    conn = sqlite3.connect("Database/smart canteen.db")
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM admin_table WHERE email=? AND password=?",
        (email, password)
    )

    admin = cursor.fetchone()

    conn.close()

    if admin:
        return jsonify({
            "status":"success",
            "message":"Admin Login Successful"
        })

    else:
        return jsonify({
            "status":"failed",
            "message":"Invalid Email or Password"
        })