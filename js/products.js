// Every product has multiple images (local paths).
// Put images at: assets/products/<id>/1.jpg, 2.jpg, 3.jpg (you can add more)

// Image structure assumed:
// assets/products/<id>/1.jpg, 2.jpg, 3.jpg ...
// Add/remove images freely per product.

window.AHAM_PRODUCTS = [
  {
    id: "chan-001",
    title: "Pure Chanderi Silk Saree",
    subtitle: "Zari Border • Festive Edit",
    price_inr: 8499,
    price_label: "₹8,499",
    tags: ["silk", "zari", "festive", "new"],
    fabric: "Chanderi Silk",
    occasion: "Festive / Wedding",
    weave: "Handwoven",
    care: "Dry Clean",
    description:
      "A refined Chanderi silk saree with a festive zari touch. Lightweight drape, premium finish.",
    images: [
      "assets/products/chan-001/1.jpg",
      "assets/products/chan-001/2.jpg",
      "assets/products/chan-001/3.jpg"
    ]
  },
  {
    id: "chan-002",
    title: "Chanderi Cotton Silk Saree",
    subtitle: "Everyday Elegance • Soft Feel",
    price_inr: 3499,
    price_label: "₹3,499",
    tags: ["cotton-silk", "everyday"],
    fabric: "Chanderi Cotton Silk",
    occasion: "Everyday / Work",
    weave: "Handwoven",
    care: "Dry Clean",
    description:
      "Breathable cotton-silk blend with a graceful drape — ideal for daily wear.",
    images: [
      "assets/products/chan-002/1.jpg",
      "assets/products/chan-002/2.jpg",
      "assets/products/chan-002/3.jpg"
    ]
  },
  {
    id: "chan-003",
    title: "Chanderi Tissue Saree",
    subtitle: "Soft Shimmer • Occasion Wear",
    price_inr: 9999,
    price_label: "₹9,999",
    tags: ["tissue", "occasion", "new"],
    fabric: "Chanderi Tissue",
    occasion: "Occasion / Evening",
    weave: "Handwoven",
    care: "Dry Clean",
    description:
      "A delicate tissue shimmer with an elegant fall — designed for standout occasions.",
    images: [
      "assets/products/chan-003/1.jpg",
      "assets/products/chan-003/2.jpg",
      "assets/products/chan-003/3.jpg"
    ]
  },
  {
    id: "chan-004",
    title: "Chanderi Buti Saree",
    subtitle: "Classic Motifs • Timeless",
    price_inr: 7499,
    price_label: "₹7,499",
    tags: ["silk", "classic"],
    fabric: "Chanderi Silk",
    occasion: "Festive / Traditional",
    weave: "Handwoven",
    care: "Dry Clean",
    description:
      "Traditional buti motifs with a premium texture. Elegant, timeless, and versatile.",
    images: [
      "assets/products/chan-004/1.jpg",
      "assets/products/chan-004/2.jpg",
      "assets/products/chan-004/3.jpg"
    ]
  },
  {
    id: "chan-005",
    title: "Chanderi Minimal Stripe Saree",
    subtitle: "Modern • Understated",
    price_inr: 4999,
    price_label: "₹4,999",
    tags: ["cotton-silk", "modern"],
    fabric: "Chanderi Cotton Silk",
    occasion: "Everyday / Semi-formal",
    weave: "Handwoven",
    care: "Dry Clean",
    description:
      "Clean stripes for a contemporary look while keeping the classic Chanderi charm.",
    images: [
      "assets/products/chan-005/1.jpg",
      "assets/products/chan-005/2.jpg",
      "assets/products/chan-005/3.jpg"
    ]
  },
  {
    id: "chan-006",
    title: "Chanderi Zari Border Saree",
    subtitle: "Wedding Ready • Rich Finish",
    price_inr: 8999,
    price_label: "₹8,999",
    tags: ["zari", "wedding"],
    fabric: "Chanderi Silk",
    occasion: "Wedding / Festive",
    weave: "Handwoven",
    care: "Dry Clean",
    description:
      "A rich zari border for a celebratory look — premium drape and elegant presence.",
    images: [
      "assets/products/chan-006/1.jpg",
      "assets/products/chan-006/2.jpg",
      "assets/products/chan-006/3.jpg"
    ]
  }
];


// Fallback placeholder if images missing
window.AHAM_PLACEHOLDERS = [
  "assets/placeholders/p1.jpg",
  "assets/placeholders/p2.jpg",
  "assets/placeholders/p3.jpg",
  "assets/placeholders/p4.jpg"
];
