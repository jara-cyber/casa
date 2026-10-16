import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../src/public-config.json',import.meta.url),'utf8'));
const url=process.env.VITE_SUPABASE_URL||config.supabaseUrl;
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||config.supabasePublishableKey;
if(!url?.startsWith('https://')||!key?.startsWith('sb_publishable_'))throw Error('Configura Project URL y una clave pública publishable en src/public-config.json o en las variables de GitHub.');
console.log('Configuración pública de Supabase válida.');
