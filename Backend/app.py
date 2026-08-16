from flask import Flask, jsonify, request
from flask_cors import CORS
from database import get_connection
import cv2
import numpy as np
from ultralytics import YOLO
import os

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "model",
    "best.pt"
)

model = YOLO(MODEL_PATH)

print("YOLO model loaded successfully!")
print("YOLO Classes:", model.names)

@app.route("/api/test", methods=["GET"])
def test():
    return jsonify({
        "status": "success",
        "message": "API Working Successfully"
    })


@app.route("/api/opencv-test", methods=["GET"])
def opencv_test():
    return jsonify({
        "status": "success",
        "opencv": cv2.__version__,
        "message": "OpenCV connected with Flask backend"
    })

@app.route("/api/detect", methods=["POST"])
def detect_food():

    if "image" not in request.files:
        return jsonify({
            "success": False,
            "error": "No image received"
        }), 400

    try:
        print("=== NEW DETECT CODE RUNNING ===")

        # --------------------------------------------------
        # 1. Receive image
        # --------------------------------------------------

        image_file = request.files["image"]
        image_bytes = image_file.read()

        # --------------------------------------------------
        # 2. Convert image to OpenCV format
        # --------------------------------------------------

        image_array = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            return jsonify({
                "success": False,
                "error": "Invalid image"
            }), 400

        print("IMAGE SHAPE:", image.shape)
        print("IMAGE SIZE:", image.size)

        # --------------------------------------------------
        # 3. YOLO Detection
        # --------------------------------------------------

        results = model(
            image,
            conf=0.03,
            imgsz=640,
            verbose=False
        )

        result = results[0]

        print("ALL DETECTIONS:")

        # --------------------------------------------------
        # 4. Check if no detection
        # --------------------------------------------------

        if result.boxes is None or len(result.boxes) == 0:
            print("NO FOOD DETECTED")

            return jsonify({
                "success": True,
                "detection": "",
                "food_name": "",
                "confidence": 0.0,
                "price": None,
                "available": False,
                "message": "No food detected"
            })

        # --------------------------------------------------
        # 5. Store all detections
        # --------------------------------------------------

        detections = []

        for box in result.boxes:

            class_id = int(box.cls[0])
            confidence_value = float(box.conf[0])
            name = model.names[class_id]

            print(
                name,
                round(confidence_value, 4)
            )

            detections.append({
                "name": name,
                "confidence": confidence_value
            })

        print("DETECTIONS LIST:", detections)

        # --------------------------------------------------
        # 6. Default = highest confidence
        # --------------------------------------------------

        best_detection = max(
            detections,
            key=lambda x: x["confidence"]
        )

        food_name = best_detection["name"]
        confidence = best_detection["confidence"]

        print(
            "BEST DETECTION:",
            food_name,
            round(confidence, 4)
        )

        # --------------------------------------------------
        # 7. Puri Bhaji priority
        # --------------------------------------------------

        puri_bhaji_detections = [
            d for d in detections
            if d["name"].strip().lower() == "puri bhaji"
        ]

        if puri_bhaji_detections:

            puri_confidence = max(
                d["confidence"]
                for d in puri_bhaji_detections
            )

            print(
                "PURI BHAJI CONFIDENCE:",
                round(puri_confidence, 4)
            )

            # Puri Bhaji priority correction
            if (
                puri_confidence >= 0.04
                and best_detection["name"].strip().lower() == "misal pav"
                and (best_detection["confidence"] - puri_confidence) <= 0.03
            ):

                food_name = "Puri Bhaji"
                confidence = puri_confidence

                print(
                    "PURI BHAJI SELECTED:",
                    round(confidence, 4)
                )

        # --------------------------------------------------
        # 8. Final detection
        # --------------------------------------------------

        print(
            "FINAL DETECTION:",
            food_name,
            round(confidence, 4)
        )

        print(
            "DEBUG FOOD:",
            food_name
        )

        print(
            "DEBUG CONFIDENCE:",
            confidence
        )

        # --------------------------------------------------
        # 9. Get food details from database
        # --------------------------------------------------

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT Food_id, Food_name, Price, Available
            FROM food_menu
            WHERE LOWER(TRIM(Food_name))
                  = LOWER(TRIM(?))
            LIMIT 1
        """, (food_name,))

        food = cursor.fetchone()

        conn.close()

        # --------------------------------------------------
        # 10. Food not found in database
        # --------------------------------------------------

        if food is None:

            print(
                "FOOD NOT FOUND IN DATABASE:",
                food_name
            )

            return jsonify({
                "success": True,
                "detection": f"{food_name}|{confidence}",
                "food_name": food_name,
                "confidence": confidence,
                "price": None,
                "available": False,
                "message": "Food detected but not found in database"
            })

        # --------------------------------------------------
        # 11. Food found
        # --------------------------------------------------

        print(
            "DATABASE FOOD:",
            food["Food_name"]
        )

        print(
            "DATABASE PRICE:",
            food["Price"]
        )

        print(
            "DATABASE AVAILABLE:",
            food["Available"]
        )

        # --------------------------------------------------
        # 12. Final API response
        # --------------------------------------------------

        return jsonify({
            "success": True,
            "detection": f"{food['Food_name']}|{confidence}",
            "food_name": food["Food_name"],
            "confidence": confidence,
            "price": food["Price"],
            "available": str(food["Available"]).lower()
                         in ["1", "true", "available"]
        })

    # ------------------------------------------------------
    # 13. Error handling
    # ------------------------------------------------------

    except Exception as e:

        print(
            "DETECTION ERROR:",
            e
        )

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
        
@app.route("/")
def home():
    return "Smart Canteen Backend Running Successfully"


@app.route("/api/foods", methods=["GET"])
def get_foods():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT Food_id,
               Category_id,
               Food_name,
               Price,
               Image,
               Available
        FROM food_menu
    """)

    rows = cursor.fetchall()

    print("FOODS FROM DATABASE:", len(rows))

    foods = []

    for row in rows:

        image_path = row["Image"].replace("\\", "/").replace("assest", "assets")

        foods.append({
            "Food_id": row["Food_id"],
            "Category_id": row["Category_id"],
            "Food_name": row["Food_name"],
            "Price": row["Price"],
            "Image": "../" + image_path,
            "Available": row["Available"]
        })

    conn.close()

    print("FOODS SENT TO FRONTEND:", len(foods))

    return jsonify(foods)

@app.route("/api/foods", methods=["POST"])
def add_food():
    data = request.get_json() or {}

    name = data.get("Food_name")
    category_id = data.get("Category_id")
    price = data.get("Price")
    image = data.get("Image", "")
    available = data.get("Available", "1")

    if not name or category_id is None or price is None:
        return jsonify({
            "success": False,
            "message": "Food name, category and price are required"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO food_menu
        (Category_id, Food_name, Price, Image, Available)
        VALUES (?, ?, ?, ?, ?)
    """, (
        category_id,
        name,
        price,
        image,
        available
    ))

    conn.commit()
    food_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "message": "Food item added successfully",
        "Food_id": food_id
    }), 201

@app.route("/api/categories")
def get_categories():
    conn = get_connection()

    categories = conn.execute(
        "SELECT * FROM Food_Category"
    ).fetchall()

    conn.close()

    return jsonify([
        dict(category) for category in categories
    ])

@app.route("/api/foods/<int:food_id>", methods=["PUT"])
def update_food(food_id):
    data = request.get_json() or {}

    name = data.get("Food_name")
    category_id = data.get("Category_id")
    price = data.get("Price")
    image = data.get("Image")
    available = data.get("Available", "1")

    if not name or category_id is None or price is None:
        return jsonify({
            "success": False,
            "message": "Food name, category and price are required"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE food_menu
        SET Food_name = ?,
            Category_id = ?,
            Price = ?,
            Image = ?,
            Available = ?
        WHERE Food_id = ?
    """, (
        name,
        category_id,
        price,
        image,
        available,
        food_id
    ))

    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Food item not found"
        }), 404

    conn.close()

    return jsonify({
        "success": True,
        "message": "Food item updated successfully"
    })

@app.route("/api/foods/<int:food_id>", methods=["DELETE"])
def delete_food(food_id):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM food_menu WHERE Food_id = ?",
        (food_id,)
    )

    conn.commit()

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Food item not found"
        }), 404

    conn.close()

    return jsonify({
        "success": True,
        "message": "Food item deleted successfully"
    }), 200

@app.route("/api/register", methods=["POST"])
def register_student():

    print("REGISTER DATA:", request.get_json())
    
    data = request.get_json()

    name = data.get("name")
    enrollment = data.get("enrollment")
    email = data.get("email")
    department = data.get("department")
    password = data.get("password")
    gender = data.get("gender")
    phone = data.get("phone")
    profile_images = data.get("profile_images")

    if not name or not enrollment or not email or not department or not password or not phone:
        return jsonify({
            "status": "error",
            "message": "Please fill all required fields"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    # Check whether enrollment number already exists
    cursor.execute(
        "SELECT Id FROM student_table WHERE Enrollment_No = ?",
        (enrollment,)
    )

    if cursor.fetchone():
        conn.close()
        return jsonify({
            "status": "error",
            "message": "Enrollment number already registered"
        }), 409

    # Check whether email already exists
    cursor.execute(
        "SELECT Id FROM student_table WHERE Email = ?",
        (email,)
    )

    if cursor.fetchone():
        conn.close()
        return jsonify({
            "status": "error",
            "message": "Email already registered"
        }), 409

    # Ensure profile_images has a sensible default when not provided
    if not profile_images:
        profile_images = 'assets/profile/Female.svg' if (gender and str(gender).lower() == 'female') else 'assets/profile/male.svg'

    cursor.execute("""
        INSERT INTO student_table
        (Name, Enrollment_No, Email, Department, Password, Gender, Profile_images, Mobile, Created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    """, (
        name,
        enrollment,
        email,
        department,
        password,
        gender,
        profile_images,
        phone
    ))

    conn.commit()
    student_id = cursor.lastrowid

    conn.close()

    return jsonify({
        "status": "success",
        "message": "Registration successful",
        "student_id": student_id
    }), 201

@app.route("/api/login-test")
def login_test():
    return "LOGIN ROUTE FILE IS LOADED"

@app.route("/api/login", methods=["POST"])
def login_student():
    print("🔥 LOGIN FUNCTION CALLED")
    data = request.get_json() or {}
    identifier = data.get('identifier')
    password = data.get('password')

    if not identifier or not password:
        return jsonify({"status": "error", "message": "Missing credentials"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT Id, Name, Enrollment_No, Email, Department, Mobile, Gender, Profile_images
        FROM student_table
        WHERE Enrollment_No = ? OR Email = ?
    """, (identifier, identifier))

    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"status": "error", "message": "User not found"}), 404

    # fetch password separately to compare
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT Password FROM student_table WHERE Id = ?", (row['Id'],))
    pwrow = cursor.fetchone()
    conn.close()

    stored_pw = pwrow['Password'] if pwrow else None
    if stored_pw != password:
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401

    return jsonify({
        "status": "success",
        "user": {
            "id": row['Id'],
            "name": row['Name'],
            "enrollment": row['Enrollment_No'],
            "email": row['Email'],
            "department": row['Department'],
            "phone": row['Mobile'],
            "gender": row['Gender'],
            "profile_images": row['Profile_images']
        }
    }), 200


@app.route('/api/update_profile', methods=['POST'])
def update_profile():
    data = request.get_json() or {}

    enrollment = data.get('enrollment')
    current_email = data.get('current_email')

    if not enrollment and not current_email:
        return jsonify({
            "status": "error",
            "message": "Missing enrollment or current email"
        }), 400

    field_map = {
        "name": "Name",
        "email": "Email",
        "department": "Department",
        "phone": "Mobile",
        "mobile": "Mobile",
        "gender": "Gender",
        "profile_images": "Profile_images",
        "password": "Password"
    }

    updates = {}

    for frontend_key, db_column in field_map.items():
        if frontend_key in data and data[frontend_key] is not None:
            updates[db_column] = data[frontend_key]

    if not updates:
        return jsonify({
            "status": "error",
            "message": "No fields to update"
        }), 400

    conn = None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # First find the exact student
        cursor.execute("""
            SELECT Id, Email, Enrollment_No
            FROM student_table
            WHERE Enrollment_No = ? OR Email = ?
            LIMIT 1
        """, (enrollment, current_email))

        student = cursor.fetchone()

        if not student:
            return jsonify({
                "status": "error",
                "message": "Student record not found"
            }), 404

        # If email is being changed, check duplicate email
        if "Email" in updates:
            new_email = str(updates["Email"]).strip()

            cursor.execute("""
                SELECT Id
                FROM student_table
                WHERE Email = ? AND Id != ?
            """, (new_email, student["Id"]))

            existing_email = cursor.fetchone()

            if existing_email:
                return jsonify({
                    "status": "error",
                    "message": "This email is already registered with another student."
                }), 409

            updates["Email"] = new_email

        set_clause = ", ".join(
            [f"{column} = ?" for column in updates.keys()]
        )

        values = list(updates.values())
        values.append(student["Id"])

        query = f"""
            UPDATE student_table
            SET {set_clause}
            WHERE Id = ?
        """

        cursor.execute(query, values)

        conn.commit()

        return jsonify({
            "status": "success",
            "message": "Profile updated successfully",
            "updated_fields": list(updates.keys())
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()

        print("PROFILE UPDATE ERROR:", repr(e))

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

    finally:
        if conn:
            conn.close()

@app.route("/api/orders", methods=["POST"])
def create_order():
    try:
        data = request.get_json()

        user_id = data.get("user_id")
        items = data.get("items", [])

        if not user_id:
            return jsonify({
                "status": "error",
                "message": "User ID is required"
            }), 400

        if not items:
            return jsonify({
                "status": "error",
                "message": "Cart is empty"
            }), 400

        conn = get_connection()
        cursor = conn.cursor()

        total_amount = 0

        # Calculate total
        for item in items:
            food_id = item.get("food_id")
            quantity = int(item.get("quantity", 1))
            price = float(item.get("price", 0))

            if not food_id or quantity <= 0:
                conn.close()
                return jsonify({
                    "status": "error",
                    "message": "Invalid cart item"
                }), 400

            total_amount += price * quantity

        # Create order
        cursor.execute("""
            INSERT INTO order_table
            (user_id, total_amount, payment_status, order_status)
            VALUES (?, ?, 'PENDING', 'PENDING')
        """, (user_id, total_amount))

        order_id = cursor.lastrowid

        # Add order items
        for item in items:
            cursor.execute("""
                INSERT INTO Order_Item_Clean
                ("order id", "food id", quantity, price)
                VALUES (?, ?, ?, ?)
            """, (
                order_id,
                item["food_id"],
                int(item["quantity"]),
                float(item["price"])
            ))

        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "message": "Order placed successfully",
            "order_id": order_id,
            "total_amount": total_amount
        }), 201

    except Exception as e:
        print("ORDER ERROR:", e)

        return jsonify({
            "status": "error",
            "message": "Failed to place order",
            "error": str(e)
        }), 500

@app.route("/api/orders/<int:order_id>/payment", methods=["PUT"])
def update_payment_status(order_id):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE order_table
            SET payment_status = 'PAID',
                order_status = 'COMPLETED'
            WHERE Id = ?
        """, (order_id,))

        if cursor.rowcount == 0:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "Order not found"
            }), 404

        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "message": "Payment status updated",
            "order_id": order_id
        }), 200

    except Exception as e:
        print("PAYMENT UPDATE ERROR:", e)

        return jsonify({
            "status": "error",
            "message": "Failed to update payment status",
            "error": str(e)
        }), 500

@app.route("/api/admin/students", methods=["GET"])
def get_admin_students():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            Id,
            Name,
            Enrollment_No,
            Email,
            Department,
            Mobile,
            Gender,
            Created_at
        FROM student_table
        ORDER BY Id DESC
    """)

    rows = cursor.fetchall()

    students = []

    for row in rows:
        students.append({
            "id": row["Id"],
            "name": row["Name"],
            "enrollment": row["Enrollment_No"],
            "email": row["Email"],
            "department": row["Department"],
            "mobile": row["Mobile"],
            "gender": row["Gender"],
            "created_at": row["Created_at"]
        })

    conn.close()

    return jsonify(students)

@app.route("/api/admin/foods", methods=["GET"])
def admin_get_foods():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT Food_id,
               Category_id,
               Food_name,
               Price,
               Image,
               Available
        FROM food_menu
        ORDER BY Food_id DESC
    """)

    rows = cursor.fetchall()
    print("API FOOD ROWS:", len(rows))

    foods = []

    for row in rows:
        foods.append({
            "Food_id": row["Food_id"],
            "Category_id": row["Category_id"],
            "Food_name": row["Food_name"],
            "Price": row["Price"],
            "Image": row["Image"],
            "Available": row["Available"]
        })

    conn.close()

    return jsonify(foods)

@app.route("/api/admin/orders", methods=["GET"])
def get_admin_orders():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            o.id AS order_id,
            o.user_id,
            s.Name AS student_name,
            s.Enrollment_No AS enrollment,
            o.total_amount,
            o.payment_status,
            o.order_status,
            o.order_time,
            oi."food id" AS food_id,
            f.Food_name AS food_name,
            oi.quantity,
            oi.price
        FROM order_table o
        JOIN student_table s
            ON o.user_id = s.Id
        JOIN Order_Item_Clean oi
            ON o.id = oi."order id"
        JOIN food_menu f
            ON oi."food id" = f.Food_id
        ORDER BY o.id DESC
    """)

    rows = cursor.fetchall()

    orders = []

    for row in rows:
        orders.append({
            "order_id": row["order_id"],
            "user_id": row["user_id"],
            "student_name": row["student_name"],
            "enrollment": row["enrollment"],
            "total_amount": row["total_amount"],
            "payment_status": row["payment_status"],
            "order_status": row["order_status"],
            "order_time": row["order_time"],
            "food_id": row["food_id"],
            "food_name": row["food_name"],
            "quantity": row["quantity"],
            "price": row["price"]
        })

    conn.close()

    return jsonify(orders)

# ============================================================
# ADMIN DASHBOARD - DATABASE APIs
# ============================================================

# ------------------------------------------------------------
# DASHBOARD STATS
# ------------------------------------------------------------
@app.route("/api/admin/dashboard", methods=["GET"])
def admin_dashboard():

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Total food items
        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM food_menu
        """)
        total_foods = cursor.fetchone()["total"]

        # Total students
        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM student_table
        """)
        total_students = cursor.fetchone()["total"]

        # Total orders
        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM order_table
        """)
        total_orders = cursor.fetchone()["total"]

        # Total revenue
        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) AS total
            FROM order_table
            WHERE UPPER(payment_status) = 'PAID'
        """)
        total_revenue = cursor.fetchone()["total"]

       # Pending orders
        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM order_table
            WHERE UPPER(order_status) = 'PENDING'
        """)
        pending_orders = cursor.fetchone()["total"]

        return jsonify({
            "success": True,
            "total_foods": total_foods,
            "total_students": total_students,
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "pending_orders": pending_orders
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()


# ============================================================
# ADMIN - FOOD CRUD
# ============================================================

# ------------------------------------------------------------
# ADD FOOD
# ------------------------------------------------------------
@app.route("/api/admin/foods", methods=["POST"])
def admin_add_food():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "error": "Request body must contain JSON"
        }), 400

    food_name = data.get("Food_name")
    category_id = data.get("Category_id")
    price = data.get("Price")
    image = data.get("Image", "")
    available = data.get("Available", "Yes")

    if not food_name:
        return jsonify({
            "success": False,
            "error": "Food name is required"
        }), 400

    if price is None:
        return jsonify({
            "success": False,
            "error": "Price is required"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            INSERT INTO food_menu
            (
                Category_id,
                Food_name,
                Price,
                Image,
                Available
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            category_id,
            food_name,
            price,
            image,
            available
        ))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Food added successfully",
            "Food_id": cursor.lastrowid
        }), 201

    except Exception as e:

        conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()


# ------------------------------------------------------------
# UPDATE FOOD
# ------------------------------------------------------------
@app.route("/api/admin/foods/<int:food_id>", methods=["PUT"])
def admin_update_food(food_id):

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "error": "Request body must contain JSON"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            UPDATE food_menu
            SET
                Category_id = ?,
                Food_name = ?,
                Price = ?,
                Image = ?,
                Available = ?
            WHERE Food_id = ?
        """, (
            data.get("Category_id"),
            data.get("Food_name"),
            data.get("Price"),
            data.get("Image", ""),
            data.get("Available", "Yes"),
            food_id
        ))

        if cursor.rowcount == 0:
            return jsonify({
                "success": False,
                "error": "Food not found"
            }), 404

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Food updated successfully"
        })

    except Exception as e:

        conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()


# ------------------------------------------------------------
# DELETE FOOD
# ------------------------------------------------------------
@app.route("/api/admin/foods/<int:food_id>", methods=["DELETE"])
def admin_delete_food(food_id):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            DELETE FROM food_menu
            WHERE Food_id = ?
        """, (food_id,))

        if cursor.rowcount == 0:
            return jsonify({
                "success": False,
                "error": "Food not found"
            }), 404

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Food deleted successfully"
        })

    except Exception as e:

        conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()


# ============================================================
# ADMIN - STUDENT CRUD
# ============================================================

# ------------------------------------------------------------
# ADD STUDENT
# ------------------------------------------------------------
@app.route("/api/admin/students", methods=["POST"])
def admin_add_student():

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "error": "Request body must contain JSON"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            INSERT INTO student_table
            (
                Name,
                Enrollment_No,
                Mobile,
                Email,
                Department,
                Password,
                Gender,
                Profile_images,
                Created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, (
            data.get("Name"),
            data.get("Enrollment_No"),
            data.get("Mobile"),
            data.get("Email"),
            data.get("Department"),
            data.get("Password"),
            data.get("Gender"),
            data.get("Profile_images")
        ))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Student added successfully",
            "Id": cursor.lastrowid
        }), 201

    except Exception as e:

        conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()


# ------------------------------------------------------------
# UPDATE STUDENT
# ------------------------------------------------------------
@app.route("/api/admin/students/<int:student_id>", methods=["PUT"])
def admin_update_student(student_id):

    data = request.get_json()

    if not data:
        return jsonify({
            "success": False,
            "error": "Request body must contain JSON"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            UPDATE student_table
            SET
                Name = ?,
                Enrollment_No = ?,
                Mobile = ?,
                Email = ?,
                Department = ?,
                Gender = ?,
                Profile_images = ?
            WHERE Id = ?
        """, (
            data.get("Name"),
            data.get("Enrollment_No"),
            data.get("Mobile"),
            data.get("Email"),
            data.get("Department"),
            data.get("Gender"),
            data.get("Profile_images"),
            student_id
        ))

        if cursor.rowcount == 0:
            return jsonify({
                "success": False,
                "error": "Student not found"
            }), 404

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Student updated successfully"
        })

    except Exception as e:

        conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()


# ------------------------------------------------------------
# DELETE STUDENT
# ------------------------------------------------------------
@app.route("/api/admin/students/<int:student_id>", methods=["DELETE"])
def admin_delete_student(student_id):

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            DELETE FROM student_table
            WHERE Id = ?
        """, (student_id,))

        if cursor.rowcount == 0:
            return jsonify({
                "success": False,
                "error": "Student not found"
            }), 404

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Student deleted successfully"
        })

    except Exception as e:

        conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()


# ============================================================
# ADMIN - QR MANAGEMENT
# ============================================================

@app.route("/api/admin/qr", methods=["GET"])
def admin_get_qr():

    conn = get_connection()
    cursor = conn.cursor()

    try:

        cursor.execute("""
            SELECT
                id,
                qr_image,
                upi_id,
                active
            FROM qr_codes_table
            ORDER BY id DESC
        """)

        rows = cursor.fetchall()

        qr_records = []

        for row in rows:
            qr_records.append({
                "id": row["id"],
                "qr_image": row["qr_image"],
                "upi_id": row["upi_id"],
                "active": row["active"]
            })

        return jsonify({
            "success": True,
            "data": qr_records
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()

@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json() or {}

    admin_id = data.get("admin_id")
    password = data.get("password")

    if not admin_id or not password:
        return jsonify({
            "status": "error",
            "message": "Admin ID and password are required"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, Username
        FROM Admin_table
        WHERE Username = ? AND Password = ?
        LIMIT 1
    """, (admin_id, password))

    admin = cursor.fetchone()
    conn.close()

    if not admin:
        return jsonify({
            "status": "error",
            "message": "Invalid admin credentials"
        }), 401

    return jsonify({
        "status": "success",
        "message": "Admin login successful",
        "admin": {
            "id": admin["id"],
            "username": admin["Username"],
            "role": "admin"
        }
    }), 200

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, title, message, created_at
        FROM notification_table
        ORDER BY id DESC
    """)

    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/api/notifications", methods=["POST"])
def add_notification():
    data = request.get_json() or {}

    title = data.get("title")
    message = data.get("message")

    if not title or not message:
        return jsonify({
            "success": False,
            "message": "Title and message are required"
        }), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO notification_table (title, message)
        VALUES (?, ?)
    """, (title, message))

    conn.commit()
    notification_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "message": "Notification added successfully",
        "id": notification_id
    }), 201

@app.route("/api/admin/notifications", methods=["GET"])
def get_admin_notifications():
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT id, title, message, created_at
            FROM notification_table
            ORDER BY id DESC
        """)

        rows = cursor.fetchall()

        notifications = []

        for row in rows:
            notifications.append({
                "id": row["id"],
                "title": row["title"],
                "message": row["message"],
                "created_at": row["created_at"]
            })

        return jsonify(notifications)

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        conn.close()

if __name__ == "__main__":
    app.run(debug=True)
