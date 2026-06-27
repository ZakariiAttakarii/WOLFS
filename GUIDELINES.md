# Development Guidelines

This project values **simplicity, speed, and low maintenance**. We prioritize standard web technologies to keep development frictionless and deployment extremely fast.

---

## 🛠️ Technology Stack Guidelines

*   **Stick to HTML & CSS:** Use semantic HTML5 and vanilla CSS. Avoid using complex CSS frameworks or compilers. Keep styles modular and clean.
*   **Vanilla JavaScript Only:** There is no need for TypeScript, React, Vue, or other complex front-end frameworks. Use standard, browser-native JavaScript.
*   **Least Complexity:** Keep third-party npm dependencies to an absolute minimum (ideally **zero**). If you can implement a feature using built-in browser APIs or standard Node.js modules, do it natively.
*   **Zero-Config Server:** Use lightweight, built-in server solutions (like the Node.js built-in `http` module) rather than large web servers unless absolutely necessary.

---

## 🚀 Deployment & Containers

*   **Serverless First:** All applications should be packaged using standard Dockerfiles and deployed to **Google Cloud Run**.
*   **Minimal Base Images:** Use tiny container base images (like `node:alpine` or `alpine` equivalents) to ensure rapid builds and near-instant scaling.
