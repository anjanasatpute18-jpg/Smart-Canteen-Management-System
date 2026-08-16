import cv2
import sqlite3
from ultralytics import YOLO

# ============================================================
# 1. CONFIGURATION
# ============================================================

# Dataset7 मधून मिळालेला best.pt
MODEL_PATH = r"best.pt"

# SQLite Database
DB_PATH = r"C:\Users\Lenovo\Desktop\smart canteen.db"

# YOLO confidence threshold
CONFIDENCE_THRESHOLD = 0.85


# ============================================================
# 2. LOAD YOLO MODEL
# ============================================================

print("Loading YOLOv8 model...")

try:
    model = YOLO(MODEL_PATH)

    print("YOLOv8 model loaded successfully!")
    print("YOLO Classes:", model.names)

except Exception as e:
    print("\nERROR: YOLO model could not be loaded.")
    print(e)
    exit()


# ============================================================
# 3. DATABASE FUNCTION
# ============================================================

def get_food_from_database(food_name):

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT Food_name, Price, Available
            FROM food_menu
            WHERE LOWER(TRIM(Food_name)) = LOWER(TRIM(?))
            LIMIT 1
        """, (food_name,))

        result = cursor.fetchone()

        conn.close()

        return result

    except Exception as e:

        print("DATABASE ERROR:", e)

        return None


# ============================================================
# 4. OPEN CAMERA
# ============================================================

cap = cv2.VideoCapture(0)

if not cap.isOpened():

    print("ERROR: Camera could not be opened.")
    exit()

print("\nCamera started successfully.")
print("Show a food item to the camera.")
print("Press Q or ESC to close camera.\n")


# ============================================================
# 5. CAMERA LOOP
# ============================================================

while True:

    ret, frame = cap.read()

    if not ret:

        print("ERROR: Could not read camera frame.")
        break


    # ========================================================
    # YOLO DETECTION
    # ========================================================

    results = model(
        frame,
        conf=CONFIDENCE_THRESHOLD,
        verbose=False
    )

    result = results[0]


    # ========================================================
    # DEFAULT RESULT
    # ========================================================

    display_name = "Unknown Food Item"
    display_price = ""


    # ========================================================
    # CHECK DETECTIONS
    # ========================================================

    if result.boxes is not None and len(result.boxes) > 0:

        # Find detection with highest confidence
        best_box = max(
            result.boxes,
            key=lambda box: float(box.conf[0])
        )

        confidence = float(best_box.conf[0])

        class_id = int(best_box.cls[0])

        detected_name = model.names[class_id]

        print(
            f"YOLO detected: {detected_name} "
            f"| Confidence: {confidence:.2f}"
        )


        # ====================================================
        # CHECK DATABASE
        # ====================================================

        food = get_food_from_database(detected_name)

        if food is not None:

            db_food_name = food[0]
            price = food[1]
            available = food[2]


            # SQLite Available = 1 means available
            if str(available) == "1":

                display_name = db_food_name

                try:
                    display_price = f"₹{float(price):g}"

                except:
                    display_price = f"₹{price}"


            else:

                display_name = "Item Not Available"

                display_price = ""


        else:

            # Food detected by YOLO but not found
            # in food_menu database

            display_name = "Unknown Food Item"

            display_price = ""


    # ========================================================
    # DRAW CAMERA FRAME
    # ========================================================

    annotated_frame = frame.copy()


    # ========================================================
    # DRAW YOLO BOXES
    # ========================================================

    if result.boxes is not None and len(result.boxes) > 0:

        for box in result.boxes:

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            cv2.rectangle(
                annotated_frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )


    # ========================================================
    # DISPLAY FOOD NAME
    # ========================================================

    cv2.putText(
        annotated_frame,
        display_name,
        (30, 50),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (0, 255, 0),
        2
    )


    # ========================================================
    # DISPLAY PRICE
    # ========================================================

    if display_price:

        cv2.putText(
            annotated_frame,
            display_price,
            (30, 90),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 255, 0),
            2
        )


    # ========================================================
    # DISPLAY WINDOW
    # ========================================================

    cv2.imshow(
        "Smart Canteen - Food Detection",
        annotated_frame
    )


    # ========================================================
    # KEYBOARD CONTROL
    # ========================================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q") or key == ord("Q") or key == 27:

        break


# ============================================================
# 6. CLOSE CAMERA
# ============================================================

cap.release()

cv2.destroyAllWindows()

print("\nCamera closed successfully.")