import type { MetadataRoute } from "next";

// 讓手機可以「加入主畫面」，像 App 一樣開啟
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "聚餐分帳 Split",
    short_name: "分帳",
    description: "聚餐、出遊分帳計算機：自訂服務費、多種分攤方式、代墊結算",
    start_url: "/",
    display: "standalone",
    background_color: "#e6e9e4",
    theme_color: "#e6e9e4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
