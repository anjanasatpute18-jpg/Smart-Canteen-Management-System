import cv2
from ultralytics import YOLO

# Your trained food model
model = YOLO("best.pt")

# Start camera
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera could not be opened.")
    exit()

while True:

    ret, frame = cap.read()

    if not ret:
        print("Could not read camera frame.")
        break

    # YOLO checks the camera frame
    results = model(frame, conf=0.70)

    food_detected = False

    for result in results:

        for box in result.boxes:

            confidence = float(box.conf[0])
            class_id = int(box.cls[0])

            food_name = model.names[class_id]

            if confidence >= 0.80:

                food_detected = True

                x1, y1, x2, y2 = map(
                    int,
                    box.xyxy[0]
                )

                cv2.rectangle(
                    frame,
                    (x1, y1),
                    (x2, y2),
                    (0, 255, 0),
                    2
                )

                cv2.putText(
                    frame,
                    f"{food_name} {confidence:.2f}",
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )

    # No food detected
    if not food_detected:

        cv2.putText(
            frame,
            "Object Not Found",
            (30, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 0, 255),
            2
        )

    cv2.imshow(
        "Smart Canteen Food Detection",
        frame
    )

    # Press Q to exit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()