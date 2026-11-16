import { crearApp } from './app.js';

const puerto = Number(process.env.PORT) || 3001;
crearApp().listen(puerto, () => {
  console.log(`API escuchando en http://localhost:${puerto}`);
});
