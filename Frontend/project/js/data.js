/* ============================================================
   Food Menu Data - Dummy JSON-style data for all menu items
   Ready to be replaced with backend API responses.
   ============================================================ */

// Helper: return a food image path for menu items, using the extracted assets/images/food folder.
function normalizeFoodKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getFoodImage(name = '') {
  const imageMap = {
    tea: 'Tea.jpg',
    pulse: 'Pulse.jpg',
    cupicecream: 'Cup Ice Cream.jpg',
    waterbottle: 'Water Bottle.jpg',
    vegthali: 'Veg Thali.jpg',
    vadapav: 'Vada Pav.jpg',
    upma: 'Upma.jpg',
    tomatochips: 'Tomato Chips.jpg',
    thumsup: 'Thums Up.jpg',
    bhel: 'Bhel.jpg',
    samosachaat: 'Samosa Chaat.jpg',
    samosa: 'Samosa.jpg',
    misalpav: 'Misal Pav.jpg',
    dosa: 'Dosa.jpg',
    lassi: 'Lassi.jpg',
    maaza: 'Maaza.jpg',
    panipuri: 'Pani Puri.jpg',
    pavbhaji: 'Pav Bhaji.jpg',
    poha: 'Poha.jpg',
    puribhaji: 'Puri Bhaji.png',
    coffee: 'Coffee.jpg',
    idli: 'Idli.jpg',
    cornettoicecream: 'Cornetto Ice Cream.jpeg',
    chocobaricecream: 'Chocobar Ice Cream.png',
    dairymilk: 'Dairy Milk.jpg',
    darkchocolate: 'Dark Chocolate.jpg',
    fizzjeerasoda: 'Fizz Jeera Soda.jpeg',
    masalachips: 'Masala Chips.jpg',
    potatochips: 'Potato Chips.jpg',
    sprite: 'Sprite.jpg',
    strawberry: 'Strawberry.jpg',
    dahipuri: 'Dahi Puri.jpg',
    tedhemedhe: 'Tedhe Medhe.jpg',
    fivestar: '5 Star.jpg',
    '5star': '5 Star.jpg'
  };

  const fileName = imageMap[normalizeFoodKey(name)] || 'placeholder.svg';
  const basePath = window.location.pathname.includes('/pages/') ? '../assets/images/food/' : 'assets/images/food/';
  return encodeURI(`${basePath}${fileName}`);
}

// Category list
const CATEGORIES = [
  { id: 1, name: "Breakfast" },
  { id: 2, name: "Snacks" },
  { id: 3, name: "Lunch" },
  { id: 4, name: "Beverages" },
  { id: 5, name: "Ice Cream" },
  { id: 6, name: "Cold Drink" },
  { id: 7, name: "South Indian" }
];
// All menu items
let MENU_ITEMS = [];

async function loadMenuItems() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/foods");

        if (!response.ok) {
            throw new Error("Failed to load food data");
        }

        const foods = await response.json();

        MENU_ITEMS = foods.map(food => ({
            id: food.Food_id,
            name: food.Food_name,
            price: food.Price,
            rating: 4.5,
            category: food.Category_id,
            img: getFoodImage(food.Food_name),
            desc: `${food.Food_name} from canteen menu.`,
            ingredients: []
        }));

        window.MENU_ITEMS = MENU_ITEMS;

        console.log("Backend food items loaded:", MENU_ITEMS);

    } catch (error) {
        console.error("Food API Error:", error);
    }
}

loadMenuItems();
// Expose globally
window.MENU_ITEMS = MENU_ITEMS;
window.CATEGORIES = CATEGORIES;

// ============================================================
// QR Code Helper Functions for Food Items
// ============================================================
// QR codes should contain: FOOD{id} (e.g., FOOD1, FOOD5, etc.)
// Use online QR code generator with this format

// Get food item by QR code data
function getFoodByQRData(qrData) {
  const foodMatch = qrData.match(/FOOD(\d+)|^(\d+)$/i);
  if (foodMatch) {
    const foodId = parseInt(foodMatch[1] || foodMatch[2]);
    return MENU_ITEMS.find(item => item.id === foodId);
  }
  return null;
}

// Get QR code format for food item
function getFoodQRCode(foodId) {
  const food = MENU_ITEMS.find(item => item.id === foodId);
  return food ? `FOOD${food.id}` : null;
}

// All QR codes reference data (for printing/setup)
const FOOD_QR_CODES = MENU_ITEMS.reduce((acc, item) => {
  acc[item.id] = `FOOD${item.id}`;
  return acc;
}, {});

window.getFoodByQRData = getFoodByQRData;
window.getFoodQRCode = getFoodQRCode;
window.FOOD_QR_CODES = FOOD_QR_CODES;
