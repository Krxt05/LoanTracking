import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API route to proxy the CSV and avoid CORS / Origin: null issues
  app.get("/api/data", async (req, res) => {
    try {
      const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYsFTD4K-tyIFIJry2YLJtnv6gUxZy9VZCvRZcOeGrD9X7inE8udy-cJU_ajJEWcouDSswJZYdAjE8/pub?gid=164801172&single=true&output=csv";
      const response = await fetch(url);
      
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
      }
      
      const csvText = await response.text();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(csvText);
    } catch (e: any) {
      console.error("Proxy error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
