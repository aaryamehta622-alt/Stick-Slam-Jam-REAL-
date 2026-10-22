import { defineConfig,loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from 'node:fs';

// https://vitejs.dev/config/
export default defineConfig(({mode})=>{
  const raw=loadEnv(mode,process.cwd(),'VITE_').VITE_MULTIPLAYER_SERVER_URL?.trim();
  let connect="'self'";
  if(raw){
    const url=new URL(raw);
    if(!['https:','http:','wss:','ws:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('VITE_MULTIPLAYER_SERVER_URL must be a plain server origin.');
    if(['http:','ws:'].includes(url.protocol)&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Production multiplayer requires HTTPS/WSS.');
    url.protocol=['https:','wss:'].includes(url.protocol)?'https:':'http:';const http=url.origin;
    url.protocol=url.protocol==='https:'?'wss:':'ws:';connect+=` ${http} ${url.origin}`;
  }
  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(),{name:'multiplayer-csp',closeBundle(){
    const file=path.resolve('dist/_headers');
    if(fs.existsSync(file))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace("connect-src 'self';",`connect-src ${connect};`));
  }}],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
};});
