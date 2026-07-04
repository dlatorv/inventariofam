# Inventario Familiar

Organizador de inventario familiar: registra lo que tienes en casa, tu lista de compras, y controla fechas de caducidad con alertas para perecederos (frutas, huevos, lácteos, etc.).

Es una app estática (HTML/CSS/JS, sin backend) que guarda todo en el `localStorage` del navegador. Pensada para publicarse con GitHub Pages y verse a pantalla completa, incluso desde el celular.

Publicada en: https://dlatorv.github.io/inventariofam/

## Funciones

- **Resumen**: alertas de ítems vencidos o por vencer.
- **Inventario**: agrega, edita y elimina lo que tienes en casa (categoría, cantidad, fecha de caducidad). Si no indicas una fecha de caducidad, se sugiere una automáticamente según la categoría (ej. frutas ~6 días, huevos/lácteos ~21 días). Botones +/- para ajustar cantidad rápido, vista de lista o mosaico con íconos por categoría, y una pantalla de PIN para que no cualquiera lo vea.
- **Lista de compras**: agrega lo que falta comprar; al marcarlo como comprado se mueve directo al inventario.
- **Ajustes**: umbral de días para avisar "por vencer", vida útil por defecto de cada categoría, e importar/exportar los datos como respaldo.

## Uso local

Abre `index.html` directamente en el navegador, o sirve la carpeta con cualquier servidor estático (ej. `python3 -m http.server`).

## Publicar en GitHub Pages

1. Fusiona esta rama a `main`.
2. En el repositorio de GitHub: **Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)`**.
3. El sitio quedará disponible en la URL que GitHub Pages te indique.
