import React, { useState } from "react";

export default function Favorites() {
  const [favorites, setFavorites] = useState([
    {
      id: 1,
      name: "Phở 24",
      address: "Quận 1, TP.HCM",
      rating: 4.6,
      distance: 1.2,
      time: 20,
      tags: ["Phở", "Việt Nam"],
      image: "https://via.placeholder.com/120"
    },
    {
      id: 2,
      name: "Bún Bò Huế O Xuân",
      address: "Quận 3, TP.HCM",
      rating: 4.8,
      distance: 2.5,
      time: 25,
      tags: ["Bún bò", "Huế"],
      image: "https://via.placeholder.com/120"
    }
  ]);

  const removeFavorite = (id) => {
    setFavorites(favorites.filter(item => item.id !== id));
  };

  return (
    <div className="min-h-screen p-5 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-5">❤️ Quán yêu thích</h1>

      {favorites.length > 0 ? (
        <div className="flex flex-col gap-4">
          {favorites.map((restaurant) => (
            <div
              key={restaurant.id}
              className="flex bg-white rounded-xl p-3 shadow hover:-translate-y-1 transition"
            >
              {/* Ảnh */}
              <img
                src={restaurant.image}
                alt=""
                className="w-[110px] h-[110px] object-cover rounded-lg"
              />

              {/* Info */}
              <div className="flex-1 ml-4">
                <h3 className="text-lg font-semibold">
                  {restaurant.name}
                </h3>

                <p className="text-sm text-gray-500">
                  📍 {restaurant.address}
                </p>

                <div className="flex gap-3 text-sm mt-1">
                  <span>⭐ {restaurant.rating}</span>
                  <span>🚴 {restaurant.distance} km</span>
                  <span>⏱ {restaurant.time} phút</span>
                </div>

                <div className="mt-2">
                  {restaurant.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-xs px-2 py-1 rounded mr-2"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col justify-between items-end">
                <button className="bg-orange-500 text-white px-3 py-1 rounded">
                  Xem
                </button>

                <button
                  onClick={() => removeFavorite(restaurant.id)}
                  className="text-xl"
                >
                  💔
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 mt-10">
          Không có quán yêu thích nào 😢
        </div>
      )}
    </div>
  );
}