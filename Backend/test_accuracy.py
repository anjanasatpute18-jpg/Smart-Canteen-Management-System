from ultralytics import YOLO
import glob
import os

model = YOLO(r".\Backend\model\best.pt")

folder = r".\Frontend\project\assets\images\food"
files = glob.glob(folder + r"\*.jpg")

correct = 0
total = 0

print("\n--- YOLO FOOD DETECTION TEST ---\n")

for file in files:

    filename = os.path.splitext(os.path.basename(file))[0]

    results = model(file, conf=0.001, verbose=False)[0]

    if len(results.boxes) == 0:
        predicted = "NONE"
        confidence = 0
    else:
        best = max(results.boxes, key=lambda b: float(b.conf[0]))
        class_id = int(best.cls[0])
        predicted = model.names[class_id]
        confidence = float(best.conf[0])

    expected = filename

    if predicted.lower().replace(" ", "") == expected.lower().replace(" ", ""):
        correct += 1
        status = "CORRECT"
    else:
        status = "WRONG"

    total += 1

    print(
        f"{filename:25} -> "
        f"{predicted:20} "
        f"{confidence:.3f} "
        f"[{status}]"
    )

print("\n-----------------------------")
print("TOTAL:", total)
print("CORRECT:", correct)
print("WRONG:", total - correct)
print("ACCURACY:", round((correct / total) * 100, 2), "%")
print("-----------------------------")