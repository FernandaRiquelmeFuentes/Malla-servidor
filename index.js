const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(path.join(__dirname)));

// Ruta principal que sirve malla-2021.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'malla-2021.html'));
});

const db = new sqlite3.Database('./database/database.sqlite', (err) => {
  if (err) {
    console.error('Error al abrir la base de datos:', err.message);
  } else {
    console.log('Base de datos conectada correctamente');
    db.run(`CREATE TABLE IF NOT EXISTS progreso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante TEXT UNIQUE,
      materias TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// Cargar archivo de dependencias
const dependenciasPath = path.join(__dirname, 'dependencias.json');
let dependencias = {};
try {
  const rawData = fs.readFileSync(dependenciasPath);
  dependencias = JSON.parse(rawData);
} catch (error) {
  console.error('Error al cargar dependencias.json:', error.message);
}

function obtenerCreditos(codigo) {
  return dependencias[codigo]?.creditos || 0;
}

app.post('/guardar', (req, res) => {
  const { estudiante, materias } = req.body;

  db.run(`
    INSERT INTO progreso (estudiante, materias) 
    VALUES (?, ?)
    ON CONFLICT(estudiante) DO UPDATE SET materias=excluded.materias, timestamp=CURRENT_TIMESTAMP`,
    [estudiante, JSON.stringify(materias)],
    (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ mensaje: 'Progreso guardado exitosamente' });
      }
    }
  );
});

app.get('/cargar/:estudiante', (req, res) => {
  const estudiante = req.params.estudiante;

  db.get(`SELECT materias FROM progreso WHERE estudiante = ?`, [estudiante], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ materias: row ? JSON.parse(row.materias) : {} });
    }
  });
});

app.get('/ranking', (req, res) => {
  db.all(`SELECT materias FROM progreso ORDER BY timestamp ASC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const ranking = rows.map((row, idx) => {
      const materias = JSON.parse(row.materias);
      let creditos = 0;

      for (const [codigo, aprobado] of Object.entries(materias)) {
        if (aprobado) {
          creditos += obtenerCreditos(codigo);
        }
      }

      return { alumno: `alumn@ ${idx + 1}`, creditos };
    });

    res.json(ranking.sort((a, b) => b.creditos - a.creditos));
  });
});
 // Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Ruta para servir el HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'malla-2021.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
