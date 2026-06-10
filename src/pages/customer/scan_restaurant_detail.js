const fs = require('fs');
const content = fs.readFileSync('c:/Users/ACER/OneDrive/Documents/GitHub/Front-end-DATN/src/pages/customer/RestaurantDetail.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('Star') || line.includes('★')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});