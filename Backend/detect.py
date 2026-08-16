from ultralytics import YOLO
import sys

# Load trained YOLO model
model = YOLO("model/best.pt")

# Get image path from Node.js
image_path = sys.argv[1]

# Run detection
results = model.predict(
    source=image_path,
    conf=0.10,
    save=False
)

# Print detected food names
for result in results:
    for box in result.boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        food_name = model.names[class_id]

        print(f"{food_name}|{confidence:.2f}")