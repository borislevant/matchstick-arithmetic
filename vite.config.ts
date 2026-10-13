import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss(), {
  name:'development-catalog',
  configurePreviewServer(server){server.middlewares.use((req,res,next)=>{
    if(['/parents','/privacy','/rules'].includes(req.url||'')){res.writeHead(302,{Location:`${req.url}/`});res.end();}else next();
  });},
  configureServer(server){server.middlewares.use('/puzzles.json',async(_req,res,next)=>{
    try{const {puzzles}=await server.ssrLoadModule('/src/data/puzzles.ts');res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(puzzles));}catch(error){next(error);}
  });}
}], server: { port: 5174 } });
